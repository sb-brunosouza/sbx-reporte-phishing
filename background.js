chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "report_phishing") {
    
    // Tenta obter identidade do Chrome (se o usuário estiver logado no navegador)
    chrome.identity.getProfileUserInfo(async (userInfo) => {
      
      // PRIORIDADE 1: E-mail do Chrome Identity
      // PRIORIDADE 2: E-mail raspado do DOM (enviado pelo content.js)
      const finalEmail = (userInfo && userInfo.email) ? userInfo.email : request.scrapedEmail;

      console.log("Processando reporte para:", finalEmail);

      if (!finalEmail) {
        sendResponse({ success: false, error: "Não foi possível identificar o remetente. Logue no Chrome." });
        return;
      }

      // Monta o payload EXATAMENTE como o Deno espera
      const payload = {
        commonEventObject: {
          parameters: {
            acao: "reportar"
          },
          userProfile: {
            email: finalEmail // AQUI ESTÁ A CORREÇÃO
          }
        },
        gmail: {
          messageId: request.messageId
        },
        // Enviamos um token fake pois o backend usa o fallback do userProfile
        authorizationEventObject: {
          userIdToken: "token_simulado_extensao_chrome" 
        }
      };

      try {
        const response = await fetch("https://yeputvtombhykynjizmz.supabase.co/functions/v1/report-phishing", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        });

        // Tenta ler o JSON, mas se falhar lê como texto para não quebrar
        const textData = await response.text();
        let jsonData = {};
        try {
          jsonData = JSON.parse(textData);
        } catch (e) {
          console.warn("Resposta não é JSON:", textData);
        }

        if (!response.ok) {
           throw new Error(jsonData.error || jsonData.message || "Erro no servidor Supabase");
        }

        sendResponse({ success: true, data: jsonData });

      } catch (error) {
        console.error("Erro no fetch:", error);
        sendResponse({ success: false, error: error.message });
      }
    });

    return true; // Mantém o canal aberto para resposta assíncrona
  }
});