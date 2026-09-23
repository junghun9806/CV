(function () {
  "use strict";

  const safeUrl = (value, fallback = "#") => {
    if (typeof value !== "string") return fallback;
    if (value.startsWith("mailto:") || value.startsWith("https://")) return value;
    if (value && !value.startsWith("//") && !/^[a-z][a-z0-9+.-]*:/i.test(value)) return value;
    return fallback;
  };

  const applyLink = (key, value) => {
    const href = safeUrl(value, null);
    document.querySelectorAll(`[data-link="${key}"]`).forEach((element) => {
      if (!href) {
        element.hidden = true;
        return;
      }
      element.hidden = false;
      element.href = href;
    });
  };

  const setText = (selector, value) => {
    document.querySelectorAll(selector).forEach((node) => {
      node.textContent = value;
    });
  };

  const renderEmails = (emails = []) => {
    const target = document.querySelector("[data-profile-emails]");
    if (!target || !Array.isArray(emails) || emails.length === 0) return;

    const label = document.createElement("span");
    label.textContent = "E-mail:";
    target.replaceChildren(label, document.createTextNode(" "));

    emails.forEach((email, index) => {
      if (index > 0) target.append(document.createTextNode("; "));
      const link = document.createElement("a");
      link.href = `mailto:${email}`;
      link.textContent = email;
      target.append(link);
    });
  };

  const renderResearch = (items = []) => {
    const target = document.querySelector("#research-list");
    if (!target || !items.length) return;
    target.replaceChildren(...items.map((item, index) => {
      const article = document.createElement("article");
      const number = document.createElement("span");
      const title = document.createElement("h3");
      const summary = document.createElement("p");
      number.textContent = String(index + 1).padStart(2, "0");
      title.textContent = item.title;
      summary.textContent = item.summary;
      article.append(number, title, summary);
      return article;
    }));
  };

  const renderProjects = (items = []) => {
    const target = document.querySelector("#project-list");
    if (!target || !items.length) return;
    target.replaceChildren(...items.map((item) => {
      const article = document.createElement("article");
      const copy = document.createElement("div");
      const year = document.createElement("span");
      const title = document.createElement("h3");
      const summary = document.createElement("p");
      copy.className = "project-copy";
      year.className = "project-year";
      year.textContent = item.period;
      title.textContent = item.title;
      summary.textContent = item.summary;
      copy.append(year, title, summary);
      article.append(copy);
      const methods = Array.isArray(item.methods)
        ? item.methods.filter((method) => typeof method === "string" && method.trim())
        : [];
      if (methods.length) {
        const panel = document.createElement("div");
        const label = document.createElement("h4");
        const list = document.createElement("ul");
        panel.className = "project-methods";
        label.textContent = "Methods & tools";
        list.setAttribute("role", "list");
        methods.forEach((method) => {
          const entry = document.createElement("li");
          entry.textContent = method;
          list.append(entry);
        });
        panel.append(label, list);
        article.append(panel);
      }
      return article;
    }));
  };

  const renderPublications = (items = []) => {
    const target = document.querySelector("#publication-list");
    if (!target || !items.length) return;
    const articles = items.map((item) => {
      const article = document.createElement("article");
      const title = document.createElement("h3");
      const citation = document.createElement("p");
      citation.className = "publication-authors";
      title.textContent = item.title;
      const authorList = Array.isArray(item.authorList) && item.authorList.length
        ? item.authorList
        : [item.authors].filter(Boolean);
      const coFirstAuthors = new Set(item.coFirstAuthors || []);
      const authorSeparator = typeof item.authorSeparator === "string" ? item.authorSeparator : ", ";
      authorList.forEach((author, index) => {
        if (index > 0) citation.append(document.createTextNode(authorSeparator));
        const authorNode = author === "J. Chae"
          ? document.createElement("strong")
          : document.createElement("span");
        authorNode.textContent = author;
        if (author === "J. Chae") authorNode.className = "self-author";
        citation.append(authorNode);
        if (coFirstAuthors.has(author)) {
          const marker = document.createElement("sup");
          marker.textContent = "†";
          marker.setAttribute("aria-label", "co-first author");
          citation.append(marker);
        }
      });
      const publicationDetail = [item.venue, item.year].filter(Boolean).join(" · ");
      article.append(title, citation);
      if (publicationDetail) {
        const meta = document.createElement("p");
        meta.className = "publication-meta";
        if (item.venue === "Under review") meta.classList.add("is-review");
        meta.textContent = publicationDetail;
        article.append(meta);
      }
      if (item.url) {
        const link = document.createElement("a");
        link.href = safeUrl(item.url);
        link.textContent = "View publication ↗";
        link.target = "_blank";
        link.rel = "noreferrer";
        article.append(link);
      }
      return article;
    });
    const note = document.createElement("p");
    note.className = "publication-note";
    note.textContent = "† Co-first author";
    target.replaceChildren(...articles, note);
  };

  const renderExperience = (items = []) => {
    const target = document.querySelector("#experience-list");
    if (!target || !items.length) return;
    target.replaceChildren(...items.map((item) => {
      const article = document.createElement("article");
      const period = document.createElement("span");
      const body = document.createElement("div");
      const title = document.createElement("h3");
      const detail = document.createElement("p");
      period.textContent = item.period;
      title.textContent = item.title;
      detail.textContent = item.detail;
      body.append(title, detail);
      article.append(period, body);
      return article;
    }));
  };

  const renderSuggestions = (items = []) => {
    const target = document.querySelector("#suggestions");
    if (!target || !items.length) return;
    target.replaceChildren(...items.slice(0, 5).map((question) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = question;
      return button;
    }));
  };

  async function loadKnowledge() {
    try {
      const response = await fetch("data/knowledge.json", { cache: "no-store" });
      if (!response.ok) throw new Error("Knowledge file could not be loaded.");
      const data = await response.json();
      const profile = data.profile || {};
      Object.entries(profile).forEach(([key, value]) => {
        if (typeof value === "string") setText(`[data-profile="${key}"]`, value);
      });
      const links = profile.links || {};
      applyLink("cv", links.cv);
      applyLink("github", links.github);
      applyLink("scholar", links.scholar);
      applyLink("orcid", links.orcid);
      renderEmails(profile.emails || (profile.email ? [profile.email] : []));
      renderResearch(data.research);
      renderProjects(data.projects);
      renderPublications(data.publications);
      renderExperience(data.experience);
      renderSuggestions(data.suggestedQuestions);
      window.dispatchEvent(new CustomEvent("knowledge-ready", { detail: data }));
    } catch (error) {
      console.error(error);
    }
  }

  const root = document.documentElement;
  const themeToggle = document.querySelector(".theme-toggle");
  const updateThemeButton = () => {
    const dark = root.dataset.theme === "dark";
    themeToggle?.setAttribute("aria-label", dark ? "Switch to light theme" : "Switch to dark theme");
    themeToggle?.setAttribute("aria-pressed", String(dark));
  };
  try {
    const savedTheme = localStorage.getItem("jhc-theme");
    if (savedTheme === "dark" || savedTheme === "light") root.dataset.theme = savedTheme;
  } catch { /* Storage may be unavailable in private or local-file contexts. */ }
  updateThemeButton();
  themeToggle?.addEventListener("click", () => {
    const next = root.dataset.theme === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    updateThemeButton();
    try { localStorage.setItem("jhc-theme", next); } catch { /* The theme still works for this visit. */ }
  });
  const updateNavigation = () => {
    document.querySelectorAll(".main-nav a").forEach((link) => {
      if (link.hash === window.location.hash) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });
  };
  window.addEventListener("hashchange", updateNavigation);
  updateNavigation();
  document.querySelector("#current-year").textContent = String(new Date().getFullYear());
  if (window.location.protocol === "file:") applyLink("cv", "data/raw/CV_Chae.pdf");
  else loadKnowledge();
})();
