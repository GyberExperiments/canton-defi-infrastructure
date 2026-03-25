use std::env;

#[derive(Debug, Clone)]
pub struct AppConfig {
    pub canton_host: String,
    pub canton_port: u16,
    pub application_id: String,
    pub party_id: String,
    pub ledger_id: String,
    pub port: u16,
    pub otc_package_id: String,
    pub auth_token: Option<String>,
    pub synchronizer_id: String,
    pub trader_party_id: String,
    /// Comma-separated allowed CORS origins (default: https://1otc.cc)
    pub allowed_origins: Vec<String>,
    /// Service-to-service Bearer token for REST API authentication
    pub api_service_token: Option<String>,
}

impl AppConfig {
    pub fn from_env() -> Self {
        Self {
            canton_host: env::var("CANTON_LEDGER_HOST")
                .unwrap_or_else(|_| "participant.validator.svc.cluster.local".into()),
            canton_port: env::var("CANTON_LEDGER_PORT")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(5001),
            application_id: env::var("CANTON_APPLICATION_ID")
                .unwrap_or_else(|_| "canton-otc-platform".into()),
            party_id: env::var("CANTON_PARTY_ID").unwrap_or_else(|_| "otc_operator".into()),
            ledger_id: env::var("CANTON_LEDGER_ID").unwrap_or_else(|_| "canton-otc".into()),
            port: env::var("PORT")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(8080),
            otc_package_id: env::var("OTC_PACKAGE_ID")
                .expect("OTC_PACKAGE_ID environment variable is required"),
            auth_token: env::var("CANTON_AUTH_TOKEN").ok().filter(|s| !s.is_empty()),
            synchronizer_id: env::var("CANTON_SYNCHRONIZER_ID").unwrap_or_default(),
            trader_party_id: env::var("CANTON_TRADER_PARTY_ID").unwrap_or_default(),
            allowed_origins: env::var("ALLOWED_ORIGINS")
                .unwrap_or_else(|_| "https://1otc.cc".into())
                .split(',')
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
                .collect(),
            api_service_token: env::var("CANTON_API_SERVICE_TOKEN")
                .ok()
                .filter(|s| !s.is_empty()),
        }
    }

    pub fn canton_endpoint(&self) -> String {
        format!("http://{}:{}", self.canton_host, self.canton_port)
    }

    /// Returns the list of parties to act as: operator (party_id) plus trader (trader_party_id) if set.
    pub fn act_as_parties(&self) -> Vec<String> {
        let mut parties = vec![self.party_id.clone()];
        if !self.trader_party_id.is_empty() {
            parties.push(self.trader_party_id.clone());
        }
        parties
    }

    pub fn validate(&self) -> Result<(), String> {
        if self.otc_package_id.is_empty() {
            return Err("OTC_PACKAGE_ID cannot be empty".into());
        }
        if self.party_id.is_empty() {
            return Err("CANTON_PARTY_ID cannot be empty".into());
        }
        Ok(())
    }
}
