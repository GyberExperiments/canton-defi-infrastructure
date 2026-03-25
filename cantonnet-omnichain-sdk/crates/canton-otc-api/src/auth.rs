use axum::extract::State;
use axum::http::{Request, StatusCode};
use axum::middleware::Next;
use axum::response::Response;
use subtle::ConstantTimeEq;

use crate::state::AppState;

/// Middleware that validates `Authorization: Bearer <token>` against
/// the configured `CANTON_API_SERVICE_TOKEN`.
///
/// - If no token is configured (dev mode): all requests pass through.
/// - If token is configured but request is missing/wrong: 401 Unauthorized.
pub async fn require_service_token(
    State(state): State<AppState>,
    req: Request<axum::body::Body>,
    next: Next,
) -> Result<Response, StatusCode> {
    let expected = match &state.config.api_service_token {
        Some(t) => t,
        None => return Ok(next.run(req).await), // dev mode: no token configured
    };

    let header = req
        .headers()
        .get("authorization")
        .and_then(|v| v.to_str().ok());

    let provided = match header {
        Some(h) if h.starts_with("Bearer ") => &h[7..],
        _ => return Err(StatusCode::UNAUTHORIZED),
    };

    // Constant-time comparison to prevent timing attacks
    if provided.as_bytes().ct_eq(expected.as_bytes()).into() {
        Ok(next.run(req).await)
    } else {
        Err(StatusCode::UNAUTHORIZED)
    }
}
