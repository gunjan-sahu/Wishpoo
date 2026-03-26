#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short,
    Address, Env, String, Vec, token,
};

// ── Constants ──────────────────────────────────────────────────────────────
const MIN_WISH_AMOUNT: i128 = 1_000_000;   // 0.1 XLM minimum wish
const MIN_GRANT:       i128 =   500_000;   // 0.05 XLM minimum grant
const MAX_WISH_TEXT:   u32  = 160;
const MAX_WISHES:      u32  = 500;

#[contracttype]
#[derive(Clone, PartialEq)]
pub enum WishStatus {
    Open,      // accepting grants
    Fulfilled, // reached or exceeded target
    Withdrawn, // wisher claimed the pool
}

#[contracttype]
#[derive(Clone)]
pub struct Wish {
    pub id:           u64,
    pub wisher:       Address,
    pub text:         String,
    pub target:       i128,   // XLM goal in stroops
    pub pool:         i128,   // total granted so far
    pub grant_count:  u32,
    pub status:       WishStatus,
    pub created_at:   u64,
}

#[contracttype]
pub enum DataKey {
    Wish(u64),
    Count,
    Recent,  // Vec<u64> last 20
}

#[contract]
pub struct WishPoolContract;

#[contractimpl]
impl WishPoolContract {
    /// Make a wish — seed it with an initial XLM amount
    pub fn make_wish(
        env: Env,
        wisher: Address,
        text: String,
        target: i128,
        seed_amount: i128,
        xlm_token: Address,
    ) -> u64 {
        wisher.require_auth();
        assert!(seed_amount >= MIN_WISH_AMOUNT, "Seed too small, min 0.1 XLM");
        assert!(target >= seed_amount, "Target must be >= seed amount");
        assert!(text.len() <= MAX_WISH_TEXT, "Wish text too long");
        assert!(text.len() > 0, "Wish text cannot be empty");

        let count: u64 = env.storage().instance()
            .get(&DataKey::Count).unwrap_or(0u64);
        assert!(count < MAX_WISHES as u64, "Wish limit reached");

        let token_client = token::Client::new(&env, &xlm_token);
        token_client.transfer(&wisher, &env.current_contract_address(), &seed_amount);

        let id = count + 1;
        let wish = Wish {
            id,
            wisher: wisher.clone(),
            text,
            target,
            pool: seed_amount,
            grant_count: 1,
            status: WishStatus::Open,
            created_at: env.ledger().timestamp(),
        };

        env.storage().persistent().set(&DataKey::Wish(id), &wish);
        env.storage().instance().set(&DataKey::Count, &id);

        let mut recent: Vec<u64> = env.storage().instance()
            .get(&DataKey::Recent).unwrap_or(Vec::new(&env));
        recent.push_back(id);
        while recent.len() > 20 { recent.remove(0); }
        env.storage().instance().set(&DataKey::Recent, &recent);

        env.events().publish((symbol_short!("wished"),), (id, wisher, seed_amount));
        id
    }

    /// Grant XLM to an open wish — anyone can contribute
    pub fn grant(
        env: Env,
        granter: Address,
        wish_id: u64,
        amount: i128,
        xlm_token: Address,
    ) {
        granter.require_auth();
        assert!(amount >= MIN_GRANT, "Grant too small, min 0.05 XLM");

        let mut wish: Wish = env.storage().persistent()
            .get(&DataKey::Wish(wish_id)).expect("Wish not found");

        assert!(wish.status == WishStatus::Open, "Wish is not open");

        let token_client = token::Client::new(&env, &xlm_token);
        token_client.transfer(&granter, &env.current_contract_address(), &amount);

        wish.pool += amount;
        wish.grant_count += 1;

        if wish.pool >= wish.target {
            wish.status = WishStatus::Fulfilled;
        }

        env.storage().persistent().set(&DataKey::Wish(wish_id), &wish);
        env.events().publish((symbol_short!("granted"),), (wish_id, granter, amount));
    }

    /// Wisher claims the pool once fulfilled (or any time as wisher)
    pub fn claim(
        env: Env,
        wisher: Address,
        wish_id: u64,
        xlm_token: Address,
    ) {
        wisher.require_auth();

        let mut wish: Wish = env.storage().persistent()
            .get(&DataKey::Wish(wish_id)).expect("Wish not found");

        assert!(wish.wisher == wisher, "Only the wisher can claim");
        assert!(
            wish.status == WishStatus::Fulfilled || wish.status == WishStatus::Open,
            "Already withdrawn"
        );
        assert!(wish.pool > 0, "Nothing to claim");

        let payout = wish.pool;
        let token_client = token::Client::new(&env, &xlm_token);
        token_client.transfer(&env.current_contract_address(), &wisher, &payout);

        wish.status = WishStatus::Withdrawn;
        wish.pool   = 0;
        env.storage().persistent().set(&DataKey::Wish(wish_id), &wish);

        env.events().publish((symbol_short!("claimed"),), (wish_id, payout));
    }

    // ── Reads ──────────────────────────────────────────────────────────────
    pub fn get_wish(env: Env, id: u64) -> Wish {
        env.storage().persistent()
            .get(&DataKey::Wish(id)).expect("Wish not found")
    }

    pub fn get_recent(env: Env) -> Vec<u64> {
        env.storage().instance()
            .get(&DataKey::Recent).unwrap_or(Vec::new(&env))
    }

    pub fn count(env: Env) -> u64 {
        env.storage().instance().get(&DataKey::Count).unwrap_or(0)
    }
}
