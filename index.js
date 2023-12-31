import express, { urlencoded } from "express";
import cors from "cors";
import dotenv from "dotenv";
import TelegramBot from "node-telegram-bot-api";
import client from "./db/config.js";
import productsRoute from "./Router/products.route.js";
import axios from "axios";
import nodeGeocoder from "node-geocoder";

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
        console.log(
          data.order_products[0].sale_price !== "undefined"
            ? data.order_products[0].sale_price
            : data.order_products[0].price
        );
        let resProduct = data.order_products.map((product) => {
          return {
            product_name: product.product_name,
            product_price:
              product.sale_price !== "undefined"
                ? product.sale_price
                : product.price,
            count: product.count,
          };
        });
        let comment = data.comment !== "" ? data.comment : null;

        let create = await client.query(
          "INSERT INTO orders(products, total, user_id, comment, payment_type, exportation) values($1, $2, $3, $4, $5, $6)",
          [
            resProduct,
            `${data.total}`,
            msg.from.id,
            comment,
            data.payment,
            data.delivery,
          ]
        );

        await bot.sendMessage(
          msg.chat.id,
          `Для завершение заказа отправьте контакт`,
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
  const location = [];

  let options = {
    provider: "openstreetmap",
  };

  let geoCoder = nodeGeocoder(options);
  await geoCoder
    .reverse({ lat: latitude, lon: longitude })
    .then((res) => {
      location.push(...res);
    })
    .catch((err) => {
      console.log(err);
    });

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
  let number =
    user.rows[0].phone_number.toString().length < 13
      ? user.rows[0].phone_number.replace("998", "")
      : user.rows[0].phone_number.replace("+998", "");

  const token = process.env.TelegramApi;
  const chat_id = process.env.CHAT_ID;
  const message = `<b>Поступил заказ с Telegram бота:</b> ${
    getCount.rows[0].max
  } %0A
  <b>Имя клиента:</b> ${msg.from.first_name} %0A
  <b>Номер:</b> ${number} | @${msg.from.username} %0A
  <b>Сумма заказа:</b> ${data.total} UZS %0A
  <b>Адрес:</b> ${location[0].formattedAddress
    .split(",")
    .splice(0, location[0].formattedAddress.split(",").length - 3)
    .toString()} [${latitude}, ${longitude} (Локация после сообщения)] %0A
          %0A
  <b>Оплате (${data.payment_type}) </b>%0A
  <b>Тип выдачи:</b> ${data.exportation} %0A
  <b>Комментарий: ${data.comment !== null ? `${data.comment}` : "Нет"}</b> %0A
  %0A
  <b>Товары в корзине:</b> ${products.map((i, index) => {
    let text = ` %0A ${index + 1}. ${i.product_name} (${
      i.product_price
    } UZS  x${i.count})`;
    return text;
  })} %0A
        `;
  console.log(products[0]);

  await axios.post(
    `https://api.telegram.org/bot${token}/sendMessage?chat_id=-1001918190466&parse_mode=html&text=${message}`
  );
  await axios.post(
    `https://api.telegram.org/bot${token}/sendLocation?chat_id=${chat_id}&latitude=${latitude}&longitude=${longitude}`
  );

  bot.sendMessage(
    msg.chat.id,
    `Ваш заказ принят! Cкоро оператор свяжется с вами! Спасибо за доверие 😊
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
