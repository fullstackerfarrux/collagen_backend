Drop database if exists collagen_bot;
create database collagen_bot;
\c collagen_bot;


drop table if exists product;
create table product(
    product_id VARCHAR DEFAULT gen_random_uuid(),
    title VARCHAR NOT NULL,
    description VARCHAR NOT NULL,
    images VARCHAR[] NOT NULL,
    price INT NOT NULL,
    status VARCHAR,
    discount BOOLEAN DEFAULT 'false',
    discount_price INT
);


drop table if exists users;
create table users(
    user_id VARCHAR NOT NUll,
    username VARCHAR NOT NULL,
    firstname VARCHAR NOT NULL,
    phone_number VARCHAR NOT NULL,
    user_location VARCHAR[]
);

drop table if exists orders;
create table orders(
    count serial unique,
    order_id VARCHAR DEFAULT gen_random_uuid(),
    phone_number VARCHAR NOT NULL,
    products VARCHAR[] NOT NULL
);


INSERT INTO users(user_id, username, firstname, phone_number) values('farrux', 'fulstacker', '998903152006');
INSERT INTO users(user_id, username, firstname, phone_number) values('komron', 'komron', '998942663122');
