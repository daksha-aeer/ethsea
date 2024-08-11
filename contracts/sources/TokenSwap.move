module 0x1::tokenswap {
    use 0x1::coin;
    use 0x1::liquidswap::liquidity_pool;

    // Public functions

    public fun swap_exact_x_for_y<X: copy, Y: copy>(
        coin_in: coin::Coin<X>,
        min_coin_out_val: u64,
        pool_address: address
    ): coin::Coin<Y> {
        let pool = borrow_global_mut<liquidity_pool::Pool<X, Y>>(pool_address);
        
        let coin_in_val = coin::value(&coin_in);
        let (coin_out_val, coin_out) = liquidity_pool::swap_exact_x_for_y(pool, coin_in_val);

        // Check if the received amount is greater than or equal to the minimum required amount
        assert!(coin_out_val >= min_coin_out_val, ERR_COIN_OUT_NUM_LESS_THAN_EXPECTED_MINIMUM);

        // Transfer the coin_out to the address
        let recipient: address = 0x1; // Replace with actual recipient address
        coin::transfer<Y>(&coin_out, recipient, coin_out_val);
        coin_out
    }

    public fun swap_exact_y_for_x<X: copy, Y: copy>(
        coin_in: coin::Coin<Y>,
        min_coin_out_val: u64,
        pool_address: address
    ): coin::Coin<X> {
        let pool = borrow_global_mut<liquidity_pool::Pool<Y, X>>(pool_address);
        
        let coin_in_val = coin::value(&coin_in);
        let (coin_out_val, coin_out) = liquidity_pool::swap_exact_y_for_x(pool, coin_in_val);

        // Check if the received amount is greater than or equal to the minimum required amount
        assert!(coin_out_val >= min_coin_out_val, ERR_COIN_OUT_NUM_LESS_THAN_EXPECTED_MINIMUM);

        // Transfer the coin_out to the address
        let recipient: address = 0x1; // Replace with actual recipient address
        coin::transfer<X>(&coin_out, recipient, coin_out_val);
        coin_out
    }
}
