//! Health checks: Canton, BSC, DB.

use std::sync::atomic::{AtomicBool, Ordering};

static CANTON_OK: AtomicBool = AtomicBool::new(false);
static BSC_OK: AtomicBool = AtomicBool::new(false);
static DB_OK: AtomicBool = AtomicBool::new(false);

pub fn set_canton_health(ok: bool) {
    CANTON_OK.store(ok, Ordering::Relaxed);
}
pub fn set_bsc_health(ok: bool) {
    BSC_OK.store(ok, Ordering::Relaxed);
}
pub fn set_db_health(ok: bool) {
    DB_OK.store(ok, Ordering::Relaxed);
}

pub fn health_status() -> (bool, bool, bool) {
    (
        CANTON_OK.load(Ordering::Relaxed),
        BSC_OK.load(Ordering::Relaxed),
        DB_OK.load(Ordering::Relaxed),
    )
}
