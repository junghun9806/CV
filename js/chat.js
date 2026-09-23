(function () {
  "use strict";

  const form = document.querySelector(".composer");
  const input = document.querySelector("#chat-input");
  const submit = form?.querySelector('button[type="submit"]');
  const messages = document.querySelector(".messages");
  const suggestions = document.querySelector("#suggestions");
  const MAX_HISTORY = 6;
  const history = [];
  let busy = false;

  const appendMessage = (role, text, options = {}) => {
    const article = document.createElement("article");
    article.className = `message ${role === "user" ? "user-message" : "assistant-message"}${options.error ? " error-message" : ""}`;
    const label = document.createElement("span");
    label.className = "message-label";
    label.textContent = role === "user" ? "YOU" : "AI";
    const body = document.createElement("div");
    if (options.loading) {
      body.className = "typing-dots";
      body.setAttribute("aria-label", "Assistant is thinking");
      body.append(document.createElement("span"), document.createElement("span"), document.createElement("span"));
    } else {
      const paragraph = document.createElement("p");
      paragraph.textContent = text;
      body.append(paragraph);
    }
    article.append(label, body);
    messages.append(article);
    messages.scrollTop = messages.scrollHeight;
    return article;
  };

  const setBusy = (value) => {
    busy = value;
    input.disabled = value;
    submit.disabled = value;
    suggestions.querySelectorAll("button").forEach((button) => { button.disabled = value; });
  };

  const resizeInput = () => {
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 160)}px`;
  };

  async function ask(question) {
    const message = question.trim();
    if (!message || busy) return;
    if (message.length > 800) {
      appendMessage("assistant", "Please keep the question under 800 characters.", { error: true });
      return;
    }

    appendMessage("user", message);
    input.value = "";
    resizeInput();
    setBusy(true);
    const loading = appendMessage("assistant", "", { loading: true });

    try {
      const endpoint = window.SITE_CONFIG?.CHAT_API_URL || "";
      if (!endpoint.startsWith("/") && !endpoint.startsWith("https://")) {
        throw new Error("The research assistant endpoint is not configured.");
      }
      if (window.location.protocol === "file:") {
        throw new Error("The research assistant works after Cloudflare deployment or through a local web server, not from a file:// address.");
      }
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message, history: history.slice(-MAX_HISTORY) }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(payload.error || "The assistant could not answer right now.");
        error.status = response.status;
        throw error;
      }
      const answer = typeof payload.answer === "string" ? payload.answer.trim() : "";
      if (!answer) throw new Error("The assistant returned an empty response.");
      loading.remove();
      appendMessage("assistant", answer);
      history.push({ role: "user", content: message }, { role: "assistant", content: answer });
      if (history.length > MAX_HISTORY) history.splice(0, history.length - MAX_HISTORY);
    } catch (error) {
      loading.remove();
      const friendly = error.status === 429
        ? "The assistant has reached its short-term question limit. Please try again in about a minute."
        : error.message || "The assistant could not answer right now. Please try again later.";
      appendMessage("assistant", friendly, { error: true });
    } finally {
      setBusy(false);
      input.focus();
    }
  }

  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    ask(input.value);
  });
  input?.addEventListener("input", resizeInput);
  input?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      form.requestSubmit();
    }
  });
  suggestions?.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (button) ask(button.textContent);
  });
})();
