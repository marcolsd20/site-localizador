// =========================
// Produtos mock
// =========================
const produtos = [
  { id: 1, nome: "Relógio Smart", preco: 2.01, categoria: "Eletrônicos", img: "img/relogio.png" },
  { id: 2, nome: "Fone Bluetooth", preco: 39.9, categoria: "Eletrônicos", img: "img/fone.png" },
  { id: 3, nome: "Mini Drone", preco: 129.9, categoria: "Brinquedos", img: "img/drone.png" },
  { id: 4, nome: "Cabo USB-C", preco: 9.9, categoria: "Acessórios", img: "img/cabo.png" },
  { id: 5, nome: "Suporte Celular", preco: 14.9, categoria: "Acessórios", img: "img/suporte.png" }
];

let carrinho = [];

// =========================
// Elementos
// =========================
const productsEl = document.getElementById("products");
const featuredEl = document.getElementById("featured");
const categoriesEl = document.getElementById("categories");
const searchEl = document.getElementById("search");
const sortEl = document.getElementById("sort");
const cartEl = document.getElementById("cart");
const cartItemsEl = document.getElementById("cartItems");
const cartTotalEl = document.getElementById("cartTotal");
const cartCountEl = document.getElementById("cartCount");
const toggleCartBtn = document.getElementById("toggleCart");
const checkoutBtn = document.getElementById("checkoutBtn");
const pixBtn = document.getElementById("pixBtn");
const pixContainer = document.getElementById("pixContainer");

// =========================
// Renderizar produtos
// =========================
function carregarProdutos(lista, target) {
  target.innerHTML = "";
  lista.forEach((p) => {
    const card = document.createElement("div");
    card.className = "product-card";
    card.innerHTML = `
      <img src="${p.img}" alt="${p.nome}">
      <h4>${p.nome}</h4>
      <p>R$ ${p.preco.toFixed(2)}</p>
      <button data-id="${p.id}">Comprar</button>
    `;
    target.appendChild(card);
  });

  target.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", () => adicionarCarrinho(parseInt(btn.dataset.id)));
  });
}
carregarProdutos(produtos, productsEl);
carregarProdutos(produtos.slice(0, 2), featuredEl);

// =========================
// Categorias
// =========================
const categorias = [...new Set(produtos.map((p) => p.categoria))];
categoriesEl.innerHTML = categorias
  .map((c) => `<button onclick="filtrarCategoria('${c}')">${c}</button>`)
  .join(" ");

function filtrarCategoria(cat) {
  const filtrados = produtos.filter((p) => p.categoria === cat);
  carregarProdutos(filtrados, productsEl);
}

// =========================
// Busca
// =========================
searchEl.addEventListener("input", (e) => {
  const termo = e.target.value.toLowerCase();
  const filtrados = produtos.filter((p) =>
    p.nome.toLowerCase().includes(termo)
  );
  carregarProdutos(filtrados, productsEl);
});

// =========================
// Ordenação
// =========================
sortEl.addEventListener("change", (e) => {
  let ordenados = [...produtos];
  if (e.target.value === "preco-asc") ordenados.sort((a, b) => a.preco - b.preco);
  if (e.target.value === "preco-desc") ordenados.sort((a, b) => b.preco - a.preco);
  carregarProdutos(ordenados, productsEl);
});

// =========================
// Carrinho
// =========================
function adicionarCarrinho(id) {
  const produto = produtos.find((p) => p.id === id);
  if (produto) {
    carrinho.push(produto);
    atualizarCarrinho();
  }
}
function atualizarCarrinho() {
  cartItemsEl.innerHTML = "";
  let total = 0;
  carrinho.forEach((p, i) => {
    total += p.preco;
    const li = document.createElement("li");
    li.innerHTML = `${p.nome} - R$ ${p.preco.toFixed(2)} <button onclick="removerCarrinho(${i})">❌</button>`;
    cartItemsEl.appendChild(li);
  });
  cartTotalEl.textContent = total.toFixed(2);
  cartCountEl.textContent = carrinho.length;
}
function removerCarrinho(index) {
  carrinho.splice(index, 1);
  atualizarCarrinho();
}
toggleCartBtn.onclick = () => cartEl.classList.toggle("hidden");

// =========================
// Detectar URL do backend automaticamente
// =========================
const BACKEND_URL = window.BACKEND_URL ||
  (window.location.hostname.includes("ngrok-free.app")
    ? window.location.origin
    : "http://localhost:3000");

console.log("🌐 Usando backend:", BACKEND_URL);

// =========================
// SDK Mercado Pago
// =========================
const mp = new MercadoPago("APP_USR-d26d833f-d511-4631-a84d-c9eeffd157e3", {
  locale: "pt-BR",
});

// =========================
// Checkout com Cartão/Boleto via Brick
// =========================
checkoutBtn.onclick = async () => {
  if (carrinho.length === 0) return alert("Carrinho vazio!");

  const items = carrinho.map(p => ({
    title: p.nome,
    quantity: 1,
    currency_id: "BRL",
    unit_price: Number(p.preco)
  }));

  try {
    const response = await fetch(`${BACKEND_URL}/create_preference`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items })
    });

    const { id } = await response.json();
    if (!id) throw new Error("Erro ao criar preferência");

    const total = carrinho.reduce((t, p) => t + p.preco, 0);

    const bricksBuilder = mp.bricks();
    await bricksBuilder.create("payment", "wallet_container", {
      initialization: { amount: total, preferenceId: id },
      customization: {
        paymentMethods: { creditCard: "all", debitCard: "all", ticket: "all", bankTransfer: "all" }
      },
      callbacks: {
        onReady: () => console.log("✅ Brick pronto"),
        onError: (error) => console.error("❌ Erro no Brick:", error),
        onSubmit: async (formData) => {
          try {
            console.log("📤 Dados enviados:", formData);

            const resp = await fetch(`${BACKEND_URL}/process_card`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(formData.formData), // ✅ ESSENCIAL
            });

            const result = await resp.json();
            console.log("💳 Resultado pagamento:", result);

            if (result.status === "approved") {
              window.location.href = "success.html";
            } else if (result.status === "in_process" || result.status === "pending") {
              window.location.href = "pending.html";
            } else {
              window.location.href = "failure.html";
            }
            return true;
          } catch (err) {
            console.error("❌ Erro processando pagamento:", err);
            return false;
          }
        }
      }
    });
  } catch (err) {
    console.error("Erro no checkout:", err);
    alert("Falha ao iniciar pagamento.");
  }
};

// =========================
// Checkout direto via PIX
// =========================
pixBtn.onclick = async () => {
  if (carrinho.length === 0) return alert("Carrinho vazio!");

  const transaction_amount = carrinho.reduce((t, p) => t + p.preco, 0);

  try {
    const response = await fetch(`${BACKEND_URL}/process_pix`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        transaction_amount,
        payer: {
          email: "cliente@test.com",
          first_name: "Cliente",
          last_name: "Teste",
          identification: { type: "CPF", number: "19119119100" }
        }
      }),
    });

    const data = await response.json();

    if (data.qr_code_base64) {
      pixContainer.innerHTML = `
        <h3>📱 Pague com Pix</h3>
        <img src="data:image/png;base64,${data.qr_code_base64}" alt="QR Code Pix" style="max-width:250px"/>
        <p><strong>Código copia e cola:</strong></p>
        <textarea readonly style="width:100%;height:80px">${data.qr_code}</textarea>
      `;

      const checkStatus = async () => {
        const resp = await fetch(`${BACKEND_URL}/payment_status/${data.id}`);
        const status = await resp.json();
        console.log("🔎 Status Pix:", status);

        if (status.status === "approved") {
          window.location.href = "success.html";
        } else if (status.status === "rejected") {
          window.location.href = "failure.html";
        } else {
          setTimeout(checkStatus, 5000);
        }
      };
      checkStatus();
    } else {
      alert("Erro ao gerar Pix.");
    }
  } catch (err) {
    console.error("❌ Erro no Pix:", err);
    alert("Falha ao conectar ao servidor Pix.");
  }
};
