// =========================
// server.js - Backend Mercado Pago
// =========================
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { MercadoPagoConfig, Payment, Preference } from "mercadopago";

dotenv.config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

// =========================
// Config Mercado Pago
// =========================
const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN,
});
const paymentClient = new Payment(client);
const preferenceClient = new Preference(client);

// =========================
// Pasta para salvar pedidos
// =========================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ordersDir = path.join(__dirname, "orders");
if (!fs.existsSync(ordersDir)) {
  fs.mkdirSync(ordersDir);
}

// Função auxiliar para salvar pedidos em JSON
function saveOrder(data, prefix = "order") {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const file = path.join(ordersDir, `${prefix}-${ts}.json`);
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
  console.log(`📦 Pedido salvo em: ${file}`);
}

// =========================
// Criar preferência (Cartão/Boleto/Pix via Brick)
// =========================
app.post("/create_preference", async (req, res) => {
  try {
    const preference = await preferenceClient.create({
      body: {
        items: req.body.items,
        back_urls: {
          success: `${process.env.PUBLIC_URL}/success.html`,
          failure: `${process.env.PUBLIC_URL}/failure.html`,
          pending: `${process.env.PUBLIC_URL}/pending.html`,
        },
        auto_return: "approved",
      },
    });
    res.json({ id: preference.id });
  } catch (err) {
    console.error("❌ Erro create_preference:", err);
    res.status(500).json({ error: "Erro ao criar preferência" });
  }
});

// =========================
// Checkout direto Pix
// =========================
app.post("/process_pix", async (req, res) => {
  try {
    const payment = await paymentClient.create({
      body: {
        transaction_amount: Number(req.body.transaction_amount),
        description: "Compra na Loja Os Irmãos",
        payment_method_id: "pix",
        payer: req.body.payer,
      },
    });

    // salvar pedido
    saveOrder({
      type: "pix",
      payer: req.body.payer,
      amount: req.body.transaction_amount,
      paymentId: payment.id,
      status: payment.status,
    }, "pix");

    res.json({
      id: payment.id,
      qr_code: payment.point_of_interaction.transaction_data.qr_code,
      qr_code_base64: payment.point_of_interaction.transaction_data.qr_code_base64,
    });
  } catch (err) {
    console.error("❌ Erro process_pix:", err);
    res.status(500).json({ error: "Erro ao processar Pix" });
  }
});

// =========================
// Checkout com Cartão via Brick
// =========================
app.post("/process_card", async (req, res) => {
  try {
    const payment = await paymentClient.create({
      body: {
        transaction_amount: Number(req.body.transaction_amount),
        token: req.body.token,
        description: "Compra na Loja Os Irmãos",
        installments: Number(req.body.installments),
        payment_method_id: req.body.payment_method_id,
        issuer_id: req.body.issuer_id,
        payer: {
          email: req.body.payer.email,
          identification: {
            type: req.body.payer.identification.type,
            number: req.body.payer.identification.number,
          },
        },
      },
    });

    // salvar pedido
    saveOrder({
      type: "card",
      payer: req.body.payer,
      amount: req.body.transaction_amount,
      installments: req.body.installments,
      paymentId: payment.id,
      status: payment.status,
      status_detail: payment.status_detail,
    }, "card");

    res.json({ status: payment.status, detail: payment.status_detail });
  } catch (err) {
    console.error("❌ Erro process_card:", err);
    res.status(500).json({ error: "Erro ao processar pagamento com cartão" });
  }
});

// =========================
// Consultar status de pagamento
// =========================
app.get("/payment_status/:id", async (req, res) => {
  try {
    const payment = await paymentClient.get({ id: req.params.id });
    res.json({ status: payment.status, detail: payment.status_detail });
  } catch (err) {
    console.error("❌ Erro payment_status:", err);
    res.status(500).json({ error: "Erro ao consultar status" });
  }
});

// =========================
// Servir frontend estático
// =========================
app.use(express.static(path.join(__dirname, "../frontend")));

// Rota padrão → abre index.html
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend", "index.html"));
});

// =========================
// Iniciar servidor
// =========================
app.listen(3000, () => {
  console.log("✅ Backend rodando em http://localhost:3000");
});
