use axum::routing::{get, post};
use axum::Router;
use axum::http::{HeaderName, HeaderValue, Method};
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;

use crate::auth;
use crate::handlers;
use crate::state::AppState;

pub fn create_router(state: AppState) -> Router {
    let cors = build_cors_layer(&state.config.allowed_origins);

    let api_routes = Router::new()
        .route("/api/v1/contracts", get(handlers::list_contracts))
        .route("/api/v1/contracts/offer", post(handlers::create_offer))
        .route("/api/v1/contracts/{id}", get(handlers::get_contract))
        .route("/api/v1/contracts/accept", post(handlers::accept_offer))
        .route("/api/v1/contracts/cancel", post(handlers::cancel_offer))
        .route(
            "/api/v1/contracts/active",
            get(handlers::get_active_contracts),
        )
        // Settlement routes
        .route("/api/v1/settlements", get(handlers::list_settlements))
        .route("/api/v1/settlements/{id}", get(handlers::get_settlement))
        .route(
            "/api/v1/settlements/create",
            post(handlers::create_settlement),
        )
        .route(
            "/api/v1/settlements/confirm",
            post(handlers::confirm_payment),
        )
        .route(
            "/api/v1/settlements/complete",
            post(handlers::complete_settlement),
        )
        // Collateral routes
        .route(
            "/api/v1/collateral/create",
            post(handlers::create_collateral),
        )
        .route(
            "/api/v1/collateral/{id}",
            get(handlers::get_collateral),
        )
        .route("/api/v1/collateral/lock", post(handlers::lock_collateral))
        .route(
            "/api/v1/collateral/release",
            post(handlers::release_collateral),
        )
        // Escrow routes
        .route("/api/v1/escrow/create", post(handlers::create_escrow))
        .route("/api/v1/escrow/{id}", get(handlers::get_escrow))
        .route("/api/v1/escrow/deposit", post(handlers::deposit_escrow))
        .route("/api/v1/escrow/release", post(handlers::release_escrow))
        .route_layer(axum::middleware::from_fn_with_state(
            state.clone(),
            auth::require_service_token,
        ));

    Router::new()
        .route("/health", get(handlers::health))
        .merge(api_routes)
        .layer(cors)
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}

fn build_cors_layer(allowed_origins: &[String]) -> CorsLayer {
    let origins: Vec<HeaderValue> = allowed_origins
        .iter()
        .filter_map(|o| o.parse::<HeaderValue>().ok())
        .collect();

    if origins.is_empty() {
        // Fallback: no CORS headers at all (deny cross-origin)
        CorsLayer::new()
    } else {
        CorsLayer::new()
            .allow_origin(origins)
            .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
            .allow_headers([
                HeaderName::from_static("content-type"),
                HeaderName::from_static("authorization"),
            ])
    }
}
