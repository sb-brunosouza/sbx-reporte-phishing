// ============================================
// PHISH ALERT BUTTON - VERSÃO OTIMISTA COM CONTADOR
// Feedback imediato + Countdown de redirecionamento
// ============================================

const PAB_ICON_URL = chrome.runtime.getURL("icon.png");

(function() {
  'use strict';
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    injectButton();
    const observer = new MutationObserver(injectButton);
    observer.observe(document.body, { childList: true, subtree: true });
    setInterval(injectButton, 2000);
  }
})();

function injectButton() {
  const emailAberto = document.querySelector('[data-message-id]');
  const botaoExiste = document.getElementById("superbid-pab-btn");

  if (!emailAberto) {
    if (botaoExiste) botaoExiste.remove();
    return;
  }

  if (botaoExiste && botaoExiste.isConnected) return;

  // Busca toolbar
  const moreButtonSelectors = [
    '[aria-label*="Mais"]', '[data-tooltip*="Mais"]', '[aria-haspopup="menu"]',
    '.T-I-Js-IF', 'div[role="button"][aria-haspopup="true"]'
  ];
  
  let moreButton = null;
  for (const selector of moreButtonSelectors) {
    const elements = document.querySelectorAll(selector);
    for (const element of elements) {
      const rect = element.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0 && rect.width < 100) {
        moreButton = element;
        break;
      }
    }
    if (moreButton) break;
  }
  
  let toolbar = null;
  if (moreButton) toolbar = moreButton.closest('[role="toolbar"]') || moreButton.parentElement;
  
  if (!toolbar) {
    const toolbarSelectors = ['.nH.if [role="toolbar"]', 'div[gh="tm"] [role="toolbar"]', '.iH [role="toolbar"]', '.G-atb'];
    for (const selector of toolbarSelectors) {
      const element = document.querySelector(selector);
      if (element && element.getBoundingClientRect().width > 0) {
        toolbar = element;
        break;
      }
    }
  }

  if (!toolbar) return;

  // Criação do Botão
  const btn = document.createElement("div");
  btn.id = "superbid-pab-btn";
  btn.className = "pab-toolbar-button";
  btn.title = "Reportar e-mail como phishing!";
  btn.setAttribute('role', 'button');
  btn.setAttribute('aria-label', 'Reportar phishing');

  const icon = document.createElement("img");
  icon.src = PAB_ICON_URL;
  icon.className = "pab-icon-img";

  const text = document.createElement("span");
  text.className = "pab-text-label";
  text.textContent = "Phish Alert";

  btn.appendChild(icon);
  btn.appendChild(text);
  btn.onclick = () => handleReport();

  const moreButtonInToolbar = toolbar.querySelector('[aria-label*="Mais"], [data-tooltip*="Mais"], [aria-haspopup="menu"], .T-I-Js-IF');
  
  if (moreButtonInToolbar) {
    toolbar.insertBefore(btn, moreButtonInToolbar);
  } else {
    toolbar.appendChild(btn);
  }
}

// ==========================================
// LÓGICA DE REPORTE
// ==========================================
async function handleReport() {
  const btn = document.getElementById("superbid-pab-btn");
  
  // 1. Confirmação
  const confirmado = await showConfirmation();
  if (!confirmado) return;

  // 2. Validações
  const messageIdElement = document.querySelector('[data-message-id]');
  if (!messageIdElement) {
    showNotification("⚠️ Abra um email para reportá-lo", "warning");
    return;
  }

  const messageId = messageIdElement.getAttribute('data-legacy-message-id') || 
                    messageIdElement.getAttribute('data-message-id');

  // Raspagem de E-mail
  let scrapedEmail = null;
  try {
    const titleMatch = document.title.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/);
    if (titleMatch) scrapedEmail = titleMatch[1];
    
    if (!scrapedEmail) {
      scrapedEmail = localStorage.getItem('pab_user_email');
    }
    
    if (!scrapedEmail) {
        const accountBtn = document.querySelector('a[aria-label*="@"][href*="SignOut"]');
        if (accountBtn) {
            const match = accountBtn.getAttribute('aria-label').match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/);
            if (match) {
                scrapedEmail = match[1];
                localStorage.setItem('pab_user_email', scrapedEmail);
            }
        }
    }
  } catch (e) { console.log(e); }

  // 3. ENVIO BLINDADO
  try {
    const payload = { 
      action: "report_phishing", 
      messageId: messageId,
      scrapedEmail: scrapedEmail 
    };

    chrome.runtime.sendMessage(payload, (response) => {
        if (chrome.runtime.lastError) {
            console.error("ERRO CRÍTICO PAB:", chrome.runtime.lastError.message);
            if (btn) btn.innerHTML = `<span class="pab-text-label" style="color: red;">❌ Erro</span>`;
            showNotification("Erro de conexão: Dê um F5 na página.", "error");
            return;
        }
    });

    // 4. SUCESSO OTIMISTA
    if (btn) {
        btn.classList.add("pab-processing");
        btn.innerHTML = `<span class="pab-text-label" style="color: green; font-weight: bold;">✅ Reportado!</span>`;
        btn.style.pointerEvents = "none";
    }

    finalizarComSucesso();

  } catch (err) {
    console.error("Erro comunicação:", err);
    showNotification("Erro interno. Dê um F5 na página.", "error");
  }
}

// === NOVA LÓGICA DE SUCESSO COM CONTADOR ===
function finalizarComSucesso() {
  let segundos = 9;

  // Função helper para gerar o texto da mensagem
  const getMsg = (s) => `
    <strong>🛡️ Email enviado para análise. Obrigado!</strong><br>
    <div style="margin-top: 6px; font-size: 0.9em; opacity: 0.95;">
      Você será redirecionado para a caixa de entrada em: <strong>${s}</strong> segundos
    </div>
  `;

  // Exibe a mensagem inicial
  showNotification(getMsg(segundos), "success");
  
  // Inicia o contador
  const intervalo = setInterval(() => {
    segundos--;
    
    // Atualiza o texto da notificação existente
    const notif = document.getElementById("pab-notification");
    if (notif) {
      notif.innerHTML = getMsg(segundos);
    }

    // Quando chegar a zero, redireciona
    if (segundos <= 0) {
      clearInterval(intervalo);
      console.log('[PAB] Redirecionando agora...');
      window.location.hash = "#inbox";
      setTimeout(() => {
        window.location.reload();
      }, 500);
    }
  }, 1000);
}

// --- Modais ---

function showConfirmation() {
  return new Promise((resolve) => {
    const existing = document.getElementById("pab-confirm-modal");
    if (existing) existing.remove();
    
    const overlay = document.createElement("div");
    overlay.id = "pab-confirm-modal";
    overlay.className = "pab-modal-overlay";
    
    const modal = document.createElement("div");
    modal.className = "pab-modal";
    
    modal.innerHTML = `
      <div class="pab-modal-header">
        <div class="pab-modal-icon">⚠️</div>
        <h3>Reportar Phishing</h3>
      </div>
      <div class="pab-modal-body">
        <p>Confirmar envio deste e-mail para análise de segurança?</p>
      </div>
      <div class="pab-modal-footer">
        <button class="pab-modal-btn pab-modal-btn-cancel" id="pab-cancel">Cancelar</button>
        <button class="pab-modal-btn pab-modal-btn-confirm" id="pab-confirm">Reportar</button>
      </div>
    `;
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    setTimeout(() => overlay.classList.add("pab-modal-show"), 10);
    
    const cleanup = (result) => {
      overlay.classList.remove("pab-modal-show");
      setTimeout(() => overlay.remove(), 200);
      resolve(result);
    };

    document.getElementById("pab-confirm").onclick = () => cleanup(true);
    document.getElementById("pab-cancel").onclick = () => cleanup(false);
  });
}

function showNotification(message, type = "info") {
  const existing = document.getElementById("pab-notification");
  if (existing) existing.remove();
  
  const notif = document.createElement("div");
  notif.id = "pab-notification";
  notif.className = `pab-notification pab-notification-${type}`;
  
  // ALTERADO: Usamos innerHTML para permitir tags <br> e <strong>
  notif.innerHTML = message;
  
  document.body.appendChild(notif);
  
  setTimeout(() => notif.classList.add("pab-notification-show"), 10);
  
  // Aumentamos o tempo para 6s para garantir que a notificação 
  // não suma antes do redirecionamento (que leva 5s)
  setTimeout(() => {
    if (notif.isConnected) {
      notif.classList.remove("pab-notification-show");
      setTimeout(() => notif.remove(), 300);
    }
  }, 6500);
}