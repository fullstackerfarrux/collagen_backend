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

        let create = await client.query(
          "INSERT INTO orders(products, total, user_id, comment, payment_type) values($1, $2, $3, $4, $5)",
          [resProduct, `${data.total}`, msg.from.id, data.comment, data.payment]
        );

        //       const token = process.env.TelegramApi;
        //       const chat_id = process.env.CHAT_ID;
        //       const message = `<b>Заявка с бота!</b> %0A
        // <b>Заказ номер: </b> ${getCount.rows[0].max}%0A
        // <b>Имя пользователя:</b> ${user.rows[0].username} %0A
        // <b>Адрес:</b> ${user.rows[0].user_location[0]}, ${
        //         user.rows[0].user_location[1]
        //       } (Локация после сообщения) %0A
        // <b>Номер телефона:</b> +${user.rows[0].phone_number} %0A
        // <b>Товары в корзине:</b> ${data.order_products.map((i) => {
        //   let text = ` %0A      - ${i.product_name} x${i.count} (${
        //     i.sale_price !== null ? i.sale_price : i.price
        //   })`;
        //   return text;
        // })} %0A
        //         %0A
        // <b>Информация об оплате (${data.payment}) </b>%0A
        // <b>Тип выдачи:</b> ${data.delivery} %0A
        // <b>Подытог:</b> ${data.undiscount} сум %0A
        // <b>Доставка:</b> ${data.delivery == "Самовызов" ? "0" : "19 000"} сум %0A
        // <b>Скидка:</b> ${data.discount !== undefined ? data.discount : "0"} сум %0A
        // <b>Итого:</b> ${data.total.toLocaleString()} сум %0A
        //       `;

        await bot.sendMessage(
          msg.chat.id,
          `Iltimos kontaktingizni jonating`,
          // `Ваш заказ принят! Cкоро оператор свяжется с вами! Спасибо за доверие 😊`,
          {
            reply_markup: JSON.stringify({
              keyboard: [
                [{ text: "Отправить контакт", request_contact: true }],
              ],
              resize_keyboard: true,
            }),
          }
        );
      }
    } catch (error) {
      console.log("error ->", error);
    }
  }
});

bot.on("contact", async (msg) => {
  const find = await client.query(
    "select * from users where phone_number = $1",
    [msg.contact.phone_number]
  );

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

  let user = await client.query("SELECT * FROM users where user_id = $1", [
    msg.from.id,
  ]);

  const getOrder = await client.query(
    "SELECT * FROM orders WHERE user_id = $1",
    [msg.from.id]
  );

  let lastIndex = getOrder.rows.length;
  let data = getOrder.rows[lastIndex - 1];
  let products = data.products.map((i) => JSON.parse(i));

  let getCount = await client.query("SELECT MAX(count) FROM orders");

  const token = process.env.TelegramApi;
  const chat_id = process.env.CHAT_ID;
  const message = `<b>Поступил заказ с Telegram бота:</b> #${
    getCount.rows[0].max
  } %0A %0A
  <b>Имя клиента:</b> ${msg.from.first_name} %0A
  <b>Номер:</b> +${user.rows[0].phone_number} | @${msg.from.username} %0A
  <b>Сумма заказа:</b> ${+data.total.toLocaleString()} UZS %0A
  <b>Адрес:</b> ${latitude}, ${longitude} (Локация после сообщения) %0A
          %0A
  <b>Оплате (${data.payment}) </b>%0A
  <b>Комментарий: ${data.comment !== null ? data.comment : "Нет"}</b>
  <b>Товары в корзине:</b> ${data.order_products.map((i, index) => {
    let text = ` %0A ${index}. ${i.product_name} (${
      i.sale_price !== null ? i.sale_price : i.price
    } UZS  x${i.count})`;
    return text;
  })} %0A
        `;

  await axios.post(
    `https://api.telegram.org/bot${token}/sendMessage?chat_id=-1001918190466&parse_mode=html&text=${message}`
  );
  await axios.post(
    `https://api.telegram.org/bot${token}/sendLocation?chat_id=${chat_id}&latitude=${latitude}&longitude=${longitude}`
  );

  bot.sendMessage(
    msg.chat.id,
    `Ваш заказ принят! Cкоро оператор свяжется с вами! Спасибо за доверие 😊 %0A 
     Для выбора товара нажмите на кнопку "Меню"`,
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

app.use(productsRoute);

app.listen(port, () => {
  console.log(port);
});
