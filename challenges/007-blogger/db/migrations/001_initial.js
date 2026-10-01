exports.up = function (knex) {
  return knex.schema
    .createTable('users', (table) => {
      table.increments('id').primary();
      table.string('username').notNullable().unique();
      table.string('email').notNullable().unique();
      table.string('password_hash').notNullable();
      table.timestamps(true, true);
    })
    .createTable('posts', (table) => {
      table.increments('id').primary();
      table.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
      table.string('title').notNullable();
      table.text('body').notNullable();
      table.boolean('is_private').notNullable().defaultTo(false);
      table.timestamps(true, true);
    });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('posts').dropTableIfExists('users');
};
