exports.up = async function up(knex) {
  const hasDirectKey = await knex.schema.hasColumn("chat_rooms", "direct_key");

  if (!hasDirectKey) {
    await knex.schema.alterTable("chat_rooms", (t) => {
      t.string("direct_key", 128).nullable();
    });
  }

  await knex.raw(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND indexname = 'idx_chat_rooms_direct_key'
      ) THEN
        CREATE INDEX idx_chat_rooms_direct_key ON chat_rooms (direct_key);
      END IF;
    END $$;
  `);

  await knex.raw(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND indexname = 'uq_chat_rooms_direct_key_active'
      ) THEN
        CREATE UNIQUE INDEX uq_chat_rooms_direct_key_active
          ON chat_rooms (direct_key)
          WHERE room_type = 'direct' AND deleted_at IS NULL AND direct_key IS NOT NULL;
      END IF;
    END $$;
  `);
};

exports.down = async function down(knex) {
  await knex.raw("DROP INDEX IF EXISTS uq_chat_rooms_direct_key_active");
  await knex.raw("DROP INDEX IF EXISTS idx_chat_rooms_direct_key");

  const hasDirectKey = await knex.schema.hasColumn("chat_rooms", "direct_key");
  if (hasDirectKey) {
    await knex.schema.alterTable("chat_rooms", (t) => {
      t.dropColumn("direct_key");
    });
  }
};
