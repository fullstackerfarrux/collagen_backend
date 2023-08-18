import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import TelegramBot from "node-telegram-bot-api";
import client from "./db/config.js";
import productsRoute from "./Router/products.route.js";
import axios from "axios";

const app = express();
app.use(cors());
app.use(express.json());
dotenv.config();

let port = process.env.PORT || 4001;
const bot = new TelegramBot(process.env.TelegramApi, { polling: true });

bot.onText(/start/, async (msg) => {
  bot.sendMessage(
    msg.chat.id,
    `Здравствуйте ${msg.chat.first_name}!
       Добро пожаловать! Я официальный бот Collagen.
       Здесь можно посмотреть меню и заказать на дом!`,
    {
      reply_markup: JSON.stringify({
        keyboard: [[{ text: "Отправить контакт", request_contact: true }]],
        resize_keyboard: true,
      }),
    }
  );
});

bot.on("contact", async (msg) => {
  const find = await client.query(
    "select * from users where phone_number = $1",
    [msg.contact.phone_number]
  );

  console.log(find);

  if (find.rowCount == 0) {
    const create = await client.query(
      "INSERT INTO users(user_id, username, firstname, phone_number) values($1, $2, $3, $4)",
      [
        msg.from.id,
        msg.chat.username,
        msg.contact.first_name,
        msg.contact.phone_number,
      ]
    );

    bot.sendMessage(msg.chat.id, `Пожалуйста отправьте геопозицию`, {
      reply_markup: JSON.stringify({
        keyboard: [[{ text: "Отправить геопозицию", request_location: true }]],
        resize_keyboard: true,
      }),
    });
  } else {
    bot.sendMessage(msg.chat.id, `Пожалуйста отправьте геопозицию`, {
      reply_markup: JSON.stringify({
        keyboard: [[{ text: "Отправить геопозицию", request_location: true }]],
        resize_keyboard: true,
      }),
    });
  }
});

bot.on("location", async (msg) => {
  let { latitude, longitude } = msg.location;
  const location = [latitude, longitude];

  const find = await client.query("select * from users where user_id = $1", [
    msg.from.id,
  ]);

  const update = await client.query(
    "UPDATE users SET user_location = $1 WHERE user_id = $2",
    [location, msg.from.id]
  );

  bot.sendMessage(
    msg.chat.id,
    `Отлично! Для выбора товара нажмите на кнопку "Меню"`,
    {
      reply_markup: JSON.stringify({
        keyboard: [
          [
            {
              text: `Меню`,
              web_app: { url: "https://www.collagenbot.uz/" },
            },
          ],
        ],
        resize_keyboard: true,
      }),
    }
  );
});

bot.on("message", async (msg) => {
  if (msg.web_app_data?.data) {
    try {
      const data = JSON.parse(msg.web_app_data.data);
      if (msg.web_app_data.data.length >= 0) {
        let resProduct = data.order_products.map((product) => {
          return {
            product_name: product.product_name,
            product_price:
              product.sale_price !== null ? product.sale_price : product.price,
            count: product.count,
          };
        });

        let user = await client.query(
          "SELECT * FROM users where user_id = $1",
          [msg.from.id]
        );

        let create = await client.query(
          "INSERT INTO orders(products, total, phone_number) values($1, $2, $3)",
          [resProduct, `${data.total}`, user.rows[0].phone_number]
        );

        let getCount = await client.query("SELECT MAX(count) FROM orders");

        const token = process.env.TelegramApi;
        const chat_id = process.env.CHAT_ID;
        const message = ` <b>Заявка с бота!</b> %0A
           <b>Заказ номер: ${getCount.rows[0].max}</b> %0A
           <b>Имя пользователя: ${user.rows[0].username}</b> %0A
           <b>Адрес: ${user.rows[0].user_location[0]}, ${
          user.rows[0].user_location[1]
        } (Локация после сообщения)</b> %0A
           <b>Номер телефона: +${user.rows[0].phone_number}</b> %0A
           <b>Товары в корзине: ${data.order_products.map((i) => {
             let text = `<b> %0A      - ${i.product_name} x ${i.count} (${
               i.sale_price !== null ? i.sale_price : i.price
             })</b>`;
             return text;
           })}</b> %0A
          %0A
          <b>Информация об оплате (наличные)</b> %0A
          <b>Подытог: ${data.total - 19000} сум</b> %0A
          <b>Доставка: 19 000 сум</b> %0A
          <b>Скидка: ${data.discount} сум</b> %0A
          <b>Итого: ${data.total} сум</b> %0A
        `;

        await axios.post(
          `https://api.telegram.org/bot${token}/sendMessage?chat_id=-1001575841712&parse_mode=html&text=${message}`
        );
        // await axios.post(
        //   `https://api.telegram.org/bot${token}/sendLocation?chat_id=${chat_id}&latitude=${user.rows[0].user_location[0]}&longitude=${user.rows[0].user_location[1]}`
        // );
      }
    } catch (error) {
      console.log("error ->", error);
    }
  }
});

app.use(productsRoute);

app.listen(port, () => {
  console.log(port);
});
