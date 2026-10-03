const list = document.querySelector("#idea-list");
const dialog = document.querySelector("#idea-dialog");
const form = document.querySelector("#idea-form");
const categoryFilter = document.querySelector("#category-filter");
const statusNames = { under_review: "In review", planned: "Planned", in_progress: "In progress", shipped: "Shipped" };
const categoryColors = { Workflow: "lavender", Integrations: "mint", Reporting: "peach", Other: "blue" };
let selectedStatus = "all";
let toastTimer;

async function request(url, options = {}) {
  const response = await fetch(url, { headers: { "Content-Type": "application/json", ...(options.headers || {}) }, ...options });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "The request could not be completed.");
  return body;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

function relativeDate(value) {
  const date = new Date(value);
  const days = Math.max(0, Math.floor((Date.now() - date.getTime()) / 86400000));
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
}

async function loadIdeas() {
  list.innerHTML = '<div class="loading-card">Gathering the good ideas<span class="loading-dots">···</span></div>';
  try {
    const params = new URLSearchParams({ status: selectedStatus, category: categoryFilter.value });
    const { ideas } = await request(`/api/ideas?${params}`);
    document.querySelector("#idea-count").textContent = String(ideas.length).padStart(2, "0");
    if (!ideas.length) {
      list.innerHTML = '<div class="empty-card"><span class="empty-icon">✳</span><h3>No ideas in this corner yet.</h3><p>Be the first to start the conversation.</p><button class="text-button" data-open-form>Share an idea ↗</button></div>';
      return;
    }
    list.innerHTML = ideas.map((idea) => `<article class="idea-card" data-id="${escapeHtml(idea.id)}">
      <button class="vote-button ${idea.voted ? "voted" : ""}" data-vote="${escapeHtml(idea.id)}" aria-label="${idea.voted ? "Remove your vote" : "Vote for this idea"}" aria-pressed="${idea.voted}"><span class="vote-arrow">↑</span><span class="vote-count">${idea.votes}</span></button>
      <div class="idea-main"><div class="idea-meta"><span class="category-pill ${categoryColors[idea.category]}">${escapeHtml(idea.category)}</span><span class="idea-date">${relativeDate(idea.created_at)}</span></div><h3>${escapeHtml(idea.title)}</h3><p>${escapeHtml(idea.description)}</p><div class="idea-footer"><span class="status-pill status-${idea.status}"><i></i>${statusNames[idea.status]}</span><span class="updated-note">${idea.status !== "under_review" ? `Updated ${relativeDate(idea.updated_at)}` : ""}</span></div></div>
      <button class="idea-more" data-manage="${escapeHtml(idea.id)}" aria-label="Update status for ${escapeHtml(idea.title)}" title="Update status">•••</button>
      <div class="status-menu" data-menu="${escapeHtml(idea.id)}" hidden>${Object.entries(statusNames).map(([key, label]) => `<button data-set-status="${key}" data-idea="${escapeHtml(idea.id)}">${label}</button>`).join("")}</div>
    </article>`).join("");
  } catch (error) {
    list.innerHTML = `<div class="error-card"><span>We couldn’t load the board.</span><button class="text-button" id="retry-load">Try again ↻</button><small>${escapeHtml(error.message)}</small></div>`;
  }
}

function openDialog() {
  dialog.showModal();
  setTimeout(() => document.querySelector("#idea-title").focus(), 50);
}
function closeDialog() { dialog.close(); form.reset(); updateCounters(); document.querySelector("#form-error").textContent = ""; }
function showToast(message) {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("visible"), 2800);
}
function updateCounters() {
  document.querySelector("#title-count").textContent = `${document.querySelector("#idea-title").value.length} / 100`;
  document.querySelector("#description-count").textContent = `${document.querySelector("#idea-description").value.length} / 600`;
}

document.querySelectorAll("#open-form-top, #open-form-hero, #open-form-bottom, #open-form-closing").forEach((button) => button.addEventListener("click", openDialog));
document.querySelector("#close-dialog").addEventListener("click", closeDialog);
document.querySelector("#cancel-dialog").addEventListener("click", closeDialog);
dialog.addEventListener("click", (event) => { if (event.target === dialog) closeDialog(); });
document.querySelectorAll("#idea-title, #idea-description").forEach((field) => field.addEventListener("input", updateCounters));
document.querySelectorAll(".filter-tab").forEach((button) => button.addEventListener("click", () => {
  document.querySelector(".filter-tab.active")?.classList.remove("active");
  button.classList.add("active");
  selectedStatus = button.dataset.status;
  loadIdeas();
}));
categoryFilter.addEventListener("change", loadIdeas);

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submit = form.querySelector('[type="submit"]');
  const error = document.querySelector("#form-error");
  submit.disabled = true;
  submit.textContent = "Adding your idea…";
  error.textContent = "";
  try {
    await request("/api/ideas", { method: "POST", body: JSON.stringify(Object.fromEntries(new FormData(form))) });
    closeDialog();
    selectedStatus = "all";
    document.querySelector('.filter-tab[data-status="all"]').click();
    showToast("Your idea is on the board. Thanks for sharing!");
  } catch (submissionError) { error.textContent = submissionError.message; }
  finally { submit.disabled = false; submit.innerHTML = 'Add to the board <span aria-hidden="true">↗</span>'; }
});

list.addEventListener("click", async (event) => {
  const retry = event.target.closest("#retry-load");
  if (retry) return loadIdeas();
  const open = event.target.closest("[data-open-form]");
  if (open) return openDialog();
  const manage = event.target.closest("[data-manage]");
  if (manage) {
    const menu = list.querySelector(`[data-menu="${CSS.escape(manage.dataset.manage)}"]`);
    list.querySelectorAll(".status-menu").forEach((item) => { if (item !== menu) item.hidden = true; });
    menu.hidden = !menu.hidden;
    return;
  }
  const setStatus = event.target.closest("[data-set-status]");
  if (setStatus) {
    const key = prompt("Enter the board admin key to update this idea's status:");
    if (!key) return;
    try {
      await request(`/api/ideas/${setStatus.dataset.idea}/status`, { method: "PATCH", headers: { "x-admin-key": key }, body: JSON.stringify({ status: setStatus.dataset.setStatus }) });
      showToast("Status updated.");
      loadIdeas();
    } catch (error) { showToast(error.message); }
    return;
  }
  const vote = event.target.closest("[data-vote]");
  if (vote) {
    vote.disabled = true;
    try { await request(`/api/ideas/${vote.dataset.vote}/vote`, { method: "POST" }); loadIdeas(); }
    catch (error) { showToast(error.message); vote.disabled = false; }
  }
});

loadIdeas();
