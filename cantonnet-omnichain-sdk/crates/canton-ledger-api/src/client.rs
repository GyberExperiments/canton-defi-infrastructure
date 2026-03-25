//! Ledger API client — connects to Canton/Daml participant and exposes Ledger API v2 services.
//! Only compiled when proto files are present (see proto/README.md).

use canton_core::{error::*, types::LedgerOffset};
use tonic::transport::Channel;
use tonic::{Request, Status};

use crate::generated::com::daml::ledger::api::v2::{
    command_service_client::CommandServiceClient,
    command_submission_service_client::CommandSubmissionServiceClient, cumulative_filter,
    get_active_contracts_response, state_service_client::StateServiceClient, command, Command,
    CreatedEvent, CumulativeFilter, EventFormat, ExerciseCommand, Filters,
    GetActiveContractsRequest, GetLedgerEndRequest, Identifier, SubmitAndWaitForTransactionRequest,
    SubmitAndWaitForTransactionResponse, SubmitAndWaitRequest, SubmitAndWaitResponse, SubmitRequest,
    TemplateFilter, Value,
};
use std::collections::HashMap;

/// Interceptor that adds Bearer token to gRPC metadata
#[derive(Clone)]
struct AuthInterceptor {
    token: Option<String>,
}

impl AuthInterceptor {
    fn new(token: Option<String>) -> Self {
        Self { token }
    }
}

impl tonic::service::Interceptor for AuthInterceptor {
    fn call(&mut self, mut request: Request<()>) -> Result<Request<()>, Status> {
        if let Some(ref token) = self.token {
            let metadata_value = format!("Bearer {}", token)
                .parse()
                .map_err(|_| Status::internal("invalid auth token"))?;
            request
                .metadata_mut()
                .insert("authorization", metadata_value);
        }
        Ok(request)
    }
}

/// Ledger API v2 client. Holds gRPC channel and service stubs.
#[derive(Clone)]
pub struct LedgerClient {
    #[allow(dead_code)] // kept for future service clients and Clone
    channel: Channel,
    ledger_id: String,
    state: StateServiceClient<
        tonic::service::interceptor::InterceptedService<Channel, AuthInterceptor>,
    >,
    command_submission: CommandSubmissionServiceClient<
        tonic::service::interceptor::InterceptedService<Channel, AuthInterceptor>,
    >,
    command: CommandServiceClient<
        tonic::service::interceptor::InterceptedService<Channel, AuthInterceptor>,
    >,
}

impl LedgerClient {
    /// Connect to a participant and create a Ledger API client.
    /// `endpoint`: e.g. `"http://localhost:5011"` or `"https://participant.example.com"`.
    /// `ledger_id`: ledger identifier (e.g. from participant config or VersionService).
    /// `auth_token`: optional JWT bearer token for authentication.
    pub async fn connect(
        endpoint: impl AsRef<str>,
        ledger_id: impl Into<String>,
    ) -> SdkResult<Self> {
        Self::connect_with_auth(endpoint, ledger_id, None).await
    }

    /// Connect with optional authentication token.
    pub async fn connect_with_auth(
        endpoint: impl AsRef<str>,
        ledger_id: impl Into<String>,
        auth_token: Option<String>,
    ) -> SdkResult<Self> {
        let endpoint = endpoint.as_ref();
        let channel = Channel::from_shared(endpoint.to_string())
            .map_err(|e| SdkError::Config(format!("invalid endpoint {:?}: {}", endpoint, e)))?
            .connect()
            .await
            .map_err(|e| SdkError::Connection {
                message: format!("failed to connect to {}: {}", endpoint, e),
                cause: Some(Box::new(e)),
                backtrace: std::backtrace::Backtrace::capture(),
            })?;
        let ledger_id = ledger_id.into();
        let interceptor = AuthInterceptor::new(auth_token);
        let state = StateServiceClient::with_interceptor(channel.clone(), interceptor.clone());
        let command_submission =
            CommandSubmissionServiceClient::with_interceptor(channel.clone(), interceptor.clone());
        let command =
            CommandServiceClient::with_interceptor(channel.clone(), interceptor);
        Ok(Self {
            channel,
            ledger_id,
            state,
            command_submission,
            command,
        })
    }

    /// Ledger identifier for this connection.
    pub fn ledger_id(&self) -> &str {
        &self.ledger_id
    }

    /// Get the current ledger end offset. Subscriptions started with this offset
    /// will receive events after this call.
    pub async fn get_ledger_end(&mut self) -> SdkResult<LedgerOffset> {
        let request = GetLedgerEndRequest {};
        let response = self
            .state
            .get_ledger_end(request)
            .await
            .map_err(grpc_status_to_sdk_error)?;
        let offset = response.into_inner().offset;
        Ok(LedgerOffset::absolute(offset.to_string()))
    }

    /// Query Active Contract Set for contracts matching a template.
    pub async fn get_active_contracts(
        &mut self,
        template_id: crate::generated::com::daml::ledger::api::v2::Identifier,
        parties: Vec<String>,
    ) -> SdkResult<Vec<CreatedEvent>> {
        let template_filter = CumulativeFilter {
            identifier_filter: Some(cumulative_filter::IdentifierFilter::TemplateFilter(
                TemplateFilter {
                    template_id: Some(template_id),
                    include_created_event_blob: false,
                },
            )),
        };

        let filters = Filters {
            cumulative: vec![template_filter],
        };

        let mut filters_by_party = HashMap::new();
        for party in &parties {
            filters_by_party.insert(party.clone(), filters.clone());
        }

        let event_format = EventFormat {
            filters_by_party,
            filters_for_any_party: None,
            verbose: true,
        };

        let request = GetActiveContractsRequest {
            active_at_offset: 0,
            event_format: Some(event_format),
        };

        let response = self
            .state
            .get_active_contracts(request)
            .await
            .map_err(grpc_status_to_sdk_error)?;

        let mut stream = response.into_inner();
        let mut results = Vec::new();

        while let Some(msg) = stream.message().await.map_err(grpc_status_to_sdk_error)? {
            if let Some(get_active_contracts_response::ContractEntry::ActiveContract(ac)) =
                msg.contract_entry
            {
                if let Some(event) = ac.created_event {
                    results.push(event);
                }
            }
        }

        Ok(results)
    }

    /// Submit commands to the ledger. Uses proto Commands (built from canton_core::types::Commands
    /// via a conversion layer when needed).
    pub async fn submit(
        &mut self,
        commands: crate::generated::com::daml::ledger::api::v2::Commands,
    ) -> SdkResult<()> {
        let request = SubmitRequest {
            commands: Some(commands),
        };
        self.command_submission
            .submit(request)
            .await
            .map_err(grpc_status_to_sdk_error)?;
        Ok(())
    }

    /// Submit commands synchronously and wait for the transaction result.
    /// Uses `CommandService/SubmitAndWait` which returns the completed transaction
    /// update ID and completion offset.
    pub async fn submit_and_wait(
        &mut self,
        commands: crate::generated::com::daml::ledger::api::v2::Commands,
    ) -> SdkResult<SubmitAndWaitResponse> {
        let request = SubmitAndWaitRequest {
            commands: Some(commands),
        };
        let response = self
            .command
            .submit_and_wait(request)
            .await
            .map_err(grpc_status_to_sdk_error)?;
        Ok(response.into_inner())
    }

    /// Submit commands and wait, returning the full transaction with created/archived events.
    /// Uses `CommandService/SubmitAndWaitForTransaction`.
    pub async fn submit_and_wait_for_transaction(
        &mut self,
        commands: crate::generated::com::daml::ledger::api::v2::Commands,
    ) -> SdkResult<SubmitAndWaitForTransactionResponse> {
        let request = SubmitAndWaitForTransactionRequest {
            commands: Some(commands),
            transaction_format: None,
        };
        let response = self
            .command
            .submit_and_wait_for_transaction(request)
            .await
            .map_err(grpc_status_to_sdk_error)?;
        Ok(response.into_inner())
    }

    /// Helper to exercise a choice on a contract.
    /// Builds an `ExerciseCommand`, wraps it in `Commands`, and submits via `submit_and_wait`.
    ///
    /// # Arguments
    /// * `template_id` - The template (or interface) identifier of the contract.
    /// * `contract_id` - The contract ID to exercise on.
    /// * `choice` - The choice name to exercise (e.g. `"Accept"`, `"Cancel"`).
    /// * `choice_argument` - The choice argument as a proto `Value`.
    /// * `act_as` - Parties authorizing the command.
    /// * `read_as` - Additional parties for contract visibility.
    /// * `application_id` - Application identifier (used as `user_id` in Commands).
    /// * `command_id` - Unique command identifier for deduplication.
    /// * `workflow_id` - Workflow identifier for correlation.
    pub async fn exercise(
        &mut self,
        template_id: Identifier,
        contract_id: &str,
        choice: &str,
        choice_argument: Value,
        act_as: Vec<String>,
        read_as: Vec<String>,
        application_id: &str,
        command_id: &str,
        workflow_id: &str,
    ) -> SdkResult<SubmitAndWaitResponse> {
        let exercise_command = ExerciseCommand {
            template_id: Some(template_id),
            contract_id: contract_id.to_string(),
            choice: choice.to_string(),
            choice_argument: Some(choice_argument),
        };

        let command = Command {
            command: Some(command::Command::Exercise(exercise_command)),
        };

        let commands = crate::generated::com::daml::ledger::api::v2::Commands {
            workflow_id: workflow_id.to_string(),
            user_id: application_id.to_string(),
            command_id: command_id.to_string(),
            commands: vec![command],
            act_as,
            read_as,
            deduplication_period: None,
            min_ledger_time_abs: None,
            min_ledger_time_rel: None,
            submission_id: String::new(),
            disclosed_contracts: Vec::new(),
            synchronizer_id: String::new(),
            package_id_selection_preference: Vec::new(),
            prefetch_contract_keys: Vec::new(),
        };

        self.submit_and_wait(commands).await
    }
}

fn grpc_status_to_sdk_error(status: Status) -> SdkError {
    let message = status.message().to_string();
    let code = status.code();
    if code == tonic::Code::Unavailable {
        SdkError::Connection {
            message,
            cause: None,
            backtrace: std::backtrace::Backtrace::capture(),
        }
    } else if code == tonic::Code::DeadlineExceeded {
        SdkError::Timeout {
            duration: std::time::Duration::from_secs(0),
            operation: message,
        }
    } else {
        SdkError::Internal {
            message: format!("grpc {}: {}", code, message),
            backtrace: std::backtrace::Backtrace::capture(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use canton_core::types::OffsetValue;

    #[test]
    fn grpc_unavailable_maps_to_connection_error() {
        let status = Status::unavailable("gone");
        let err = grpc_status_to_sdk_error(status);
        assert!(matches!(err, SdkError::Connection { .. }));
    }

    #[test]
    fn grpc_deadline_exceeded_maps_to_timeout() {
        let status = Status::deadline_exceeded("took too long");
        let err = grpc_status_to_sdk_error(status);
        assert!(matches!(err, SdkError::Timeout { .. }));
    }

    #[test]
    fn ledger_offset_absolute_from_get_ledger_end_response() {
        let offset = LedgerOffset::absolute(42_i64.to_string());
        assert!(matches!(offset.value, OffsetValue::Absolute(ref s) if s == "42"));
    }
}
