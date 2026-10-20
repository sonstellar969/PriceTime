CREATE TABLE "mf_users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"display_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mf_order_events" (
	"sequence" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "mf_order_events_sequence_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"symbol" text NOT NULL,
	"kind" text NOT NULL,
	"order_id" integer NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mf_orders" (
	"symbol" text NOT NULL,
	"order_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"side" text NOT NULL,
	"type" text NOT NULL,
	"limit_price_paise" bigint,
	"original_quantity" integer NOT NULL,
	"remaining_quantity" integer NOT NULL,
	"status" text NOT NULL,
	"reserved_cash_paise" bigint DEFAULT 0 NOT NULL,
	"reserved_shares" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cancelled_at" timestamp with time zone,
	CONSTRAINT "mf_orders_symbol_order_id_pk" PRIMARY KEY("symbol","order_id")
);
--> statement-breakpoint
CREATE TABLE "mf_portfolio_lots" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "mf_portfolio_lots_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" text NOT NULL,
	"symbol" text NOT NULL,
	"quantity" integer NOT NULL,
	"unit_cost_paise" bigint NOT NULL,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mf_positions" (
	"user_id" text NOT NULL,
	"symbol" text NOT NULL,
	"available_shares" integer DEFAULT 0 NOT NULL,
	"reserved_shares" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "mf_positions_user_id_symbol_pk" PRIMARY KEY("user_id","symbol")
);
--> statement-breakpoint
CREATE TABLE "mf_realized_pnl" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "mf_realized_pnl_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" text NOT NULL,
	"symbol" text NOT NULL,
	"trade_id" integer NOT NULL,
	"quantity" integer NOT NULL,
	"cost_basis_paise" bigint NOT NULL,
	"proceeds_paise" bigint NOT NULL,
	"realized_paise" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mf_replay_runs" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "mf_replay_runs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" text NOT NULL,
	"order_count" integer NOT NULL,
	"bst_duration_ms" integer NOT NULL,
	"array_duration_ms" integer NOT NULL,
	"trade_count" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mf_trades" (
	"symbol" text NOT NULL,
	"trade_id" integer NOT NULL,
	"price_paise" bigint NOT NULL,
	"quantity" integer NOT NULL,
	"buy_order_id" integer NOT NULL,
	"sell_order_id" integer NOT NULL,
	"buyer_id" text NOT NULL,
	"seller_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mf_trades_symbol_trade_id_pk" PRIMARY KEY("symbol","trade_id")
);
--> statement-breakpoint
CREATE TABLE "mf_wallets" (
	"user_id" text PRIMARY KEY NOT NULL,
	"available_cash_paise" bigint DEFAULT 0 NOT NULL,
	"reserved_cash_paise" bigint DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mf_orders" ADD CONSTRAINT "mf_orders_user_id_mf_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."mf_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mf_portfolio_lots" ADD CONSTRAINT "mf_portfolio_lots_user_id_mf_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."mf_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mf_positions" ADD CONSTRAINT "mf_positions_user_id_mf_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."mf_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mf_realized_pnl" ADD CONSTRAINT "mf_realized_pnl_user_id_mf_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."mf_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mf_replay_runs" ADD CONSTRAINT "mf_replay_runs_user_id_mf_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."mf_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mf_trades" ADD CONSTRAINT "mf_trades_buyer_id_mf_users_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."mf_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mf_trades" ADD CONSTRAINT "mf_trades_seller_id_mf_users_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."mf_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mf_wallets" ADD CONSTRAINT "mf_wallets_user_id_mf_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."mf_users"("id") ON DELETE no action ON UPDATE no action;