let currentAvatar = "";

async function loadProfile() {
  const res = await apiFetch("/auth/me");
  if (!res) return;
  const user = await res.json();

  document.getElementById("profile-name").textContent = user.name;
  document.getElementById("profile-email").textContent = user.email;
  document.getElementById("edit-name").value = user.name;
  document.getElementById("edit-email").value = user.email;

  currentAvatar = user.avatar || "";
  renderAvatar(user.name, currentAvatar);

  const nameEl = document.getElementById("user-name");
  if (nameEl) nameEl.textContent = `👋 ${user.name}`;
  localStorage.setItem("user", JSON.stringify({ ...currentUser, ...user }));
}

function renderAvatar(name, avatarUrl) {
  const initialEl = document.getElementById("profile-avatar");
  const imgEl = document.getElementById("profile-avatar-img");

  if (avatarUrl) {
    imgEl.src = avatarUrl;
    imgEl.style.display = "block";
    initialEl.style.display = "none";
  } else {
    initialEl.textContent = (name || "?").trim().charAt(0).toUpperCase();
    initialEl.style.display = "flex";
    imgEl.style.display = "none";
  }
}

const editBtn = document.getElementById("edit-btn");
const viewMode = document.getElementById("view-mode");
const editForm = document.getElementById("edit-form");
const uploadLabel = document.getElementById("avatar-upload-label");

function enterEditMode() {
  viewMode.style.display = "none";
  editForm.style.display = "flex";
  uploadLabel.style.display = "flex";
}

function exitEditMode() {
  viewMode.style.display = "block";
  editForm.style.display = "none";
  uploadLabel.style.display = "none";
  document.getElementById("edit-error").textContent = "";
}

editBtn.addEventListener("click", enterEditMode);
document.getElementById("cancel-edit-btn").addEventListener("click", () => {
  loadProfile();
  exitEditMode();
});

document.getElementById("avatar-input").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;

  if (file.size > 2 * 1024 * 1024) {
    document.getElementById("edit-error").textContent = "Image must be under 2MB";
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    currentAvatar = reader.result;
    renderAvatar(document.getElementById("edit-name").value, currentAvatar);
  };
  reader.readAsDataURL(file);
});

document.getElementById("avatar-upload-label").addEventListener("click", (e) => {
  e.preventDefault();
  document.getElementById("avatar-input").click();
});

editForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById("edit-error");
  errorEl.textContent = "";

  const name = document.getElementById("edit-name").value.trim();
  const email = document.getElementById("edit-email").value.trim();

  const res = await apiFetch("/auth/me", {
    method: "PUT",
    body: JSON.stringify({ name, email, avatar: currentAvatar }),
  });

  if (!res) return;

  const data = await res.json();

  if (!res.ok) {
    errorEl.textContent = data.msg || "Could not save changes";
    return;
  }

  document.getElementById("profile-name").textContent = data.name;
  document.getElementById("profile-email").textContent = data.email;
  localStorage.setItem("user", JSON.stringify(data));

  exitEditMode();
});

loadProfile();
