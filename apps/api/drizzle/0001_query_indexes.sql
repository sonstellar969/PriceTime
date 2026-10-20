CREATE UNIQUE INDEX "mf_users_email_idx" ON "mf_users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "mf_events_symbol_sequence_idx" ON "mf_order_events" USING btree ("symbol","sequence");--> statement-breakpoint
CREATE INDEX "mf_orders_user_created_idx" ON "mf_orders" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "mf_lots_user_symbol_fifo_idx" ON "mf_portfolio_lots" USING btree ("user_id","symbol","opened_at","id");--> statement-breakpoint
CREATE INDEX "mf_replay_user_created_idx" ON "mf_replay_runs" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "mf_trades_buyer_created_idx" ON "mf_trades" USING btree ("buyer_id","created_at");--> statement-breakpoint
CREATE INDEX "mf_trades_seller_created_idx" ON "mf_trades" USING btree ("seller_id","created_at");