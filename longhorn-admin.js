function setupAdmin() {
  const login = document.getElementById("admin-login");
  const workspace = document.getElementById("admin-workspace");
  if (!login || !workspace) return;

  let selectedId = "";
  let selectedPhotos = [];
  let activeStatusFilters = new Set(["all"]);
  let adminSearchTerm = "";
  let analyticsLoaded = false;
  let locationsExpanded = false;
  const inventoryView = document.getElementById("admin-inventory-view");
  const analyticsView = document.getElementById("admin-analytics-view");
  const viewButtons = document.querySelectorAll("[data-admin-view]");

  const fields = {
    id: document.getElementById("car-id"),
    number: document.getElementById("car-number"),
    name: document.getElementById("car-name"),
    trim: document.getElementById("car-trim"),
    status: document.getElementById("car-status"),
    type: document.getElementById("car-type"),
    price: document.getElementById("car-price"),
    exterior: document.getElementById("car-exterior"),
    interior: document.getElementById("car-interior"),
    mileage: document.getElementById("car-mileage"),
    vin: document.getElementById("car-vin"),
    featured: document.getElementById("car-featured"),
    image: document.getElementById("car-image"),
    upload: document.getElementById("car-image-upload"),
    carfaxImage: document.getElementById("car-carfax-image"),
    carfaxUpload: document.getElementById("car-carfax-upload"),
    description: document.getElementById("car-description")
  };

  function loadCar(car) {
    selectedId = car.id;
    selectedPhotos = getCarPhotos(car);
    fields.id.value = car.id;
    fields.number.value = car.number || "";
    fields.name.value = car.name;
    fields.trim.value = car.trim || "";
    fields.status.value = car.status;
    fields.type.value = vehicleType(car);
    fields.price.value = car.price;
    fields.exterior.value = car.exterior;
    fields.interior.value = car.interior;
    fields.mileage.value = car.mileage;
    fields.vin.value = car.vin || "TBD";
    fields.featured.checked = Boolean(car.featured);
    fields.image.value = selectedPhotos[0];
    fields.carfaxImage.value = car.carfaxImage || "";
    fields.description.value = car.description;
    renderPhotoList();
    renderCarfaxPreview();
  }

  function renderPhotoList() {
    const list = document.getElementById("admin-photo-list");
    list.innerHTML = selectedPhotos.map((photo, index) => `
      <div class="admin-photo-item">
        <img src="${photo}" alt="Vehicle photo ${index + 1}">
        <div>
          <strong>${index === 0 ? "Main photo" : `Photo ${index + 1}`}</strong>
          <button type="button" data-photo="${photo}">Delete photo</button>
        </div>
      </div>
    `).join("") || `<p class="admin-note">No photos yet.</p>`;
    list.querySelectorAll("button").forEach((button) => {
      button.addEventListener("click", async () => {
        selectedPhotos = selectedPhotos.filter((photo) => photo !== button.dataset.photo);
        if (button.dataset.photo.startsWith("assets/uploads/")) {
          await api(`/api/upload?path=${encodeURIComponent(button.dataset.photo)}`, { method: "DELETE" });
        }
        fields.image.value = selectedPhotos[0] || "";
        renderPhotoList();
        await saveCurrentPhotos();
      });
    });
  }

  function renderCarfaxPreview() {
    const preview = document.getElementById("admin-carfax-preview");
    const carfaxImage = fields.carfaxImage.value;
    preview.innerHTML = carfaxImage ? `
      <div class="admin-photo-item">
        <img src="${carfaxImage}" alt="Carfax image">
        <div>
          <strong>Carfax image</strong>
          <button type="button" id="delete-carfax-image">Delete Carfax image</button>
        </div>
      </div>
    ` : `<p class="admin-note">No Carfax image added.</p>`;
    const deleteButton = document.getElementById("delete-carfax-image");
    if (deleteButton) {
      deleteButton.addEventListener("click", async () => {
        const imagePath = fields.carfaxImage.value;
        fields.carfaxImage.value = "";
        if (imagePath.startsWith("assets/uploads/")) {
          await api(`/api/upload?path=${encodeURIComponent(imagePath)}`, { method: "DELETE" });
        }
        renderCarfaxPreview();
        await saveCurrentCarfax();
      });
    }
  }

  function renderAdminList() {
    const list = document.getElementById("admin-list");
    const statusFilteredCars = activeStatusFilters.has("all")
      ? carsCache
      : carsCache.filter((car) => activeStatusFilters.has(car.status));
    const filteredCars = adminSearchTerm
      ? statusFilteredCars.filter((car) => [
          car.number,
          car.name,
          car.trim,
          car.vin,
          vehicleType(car),
          car.exterior,
          car.interior,
          car.status,
          car.price,
          car.mileage
        ].join(" ").toLowerCase().includes(adminSearchTerm))
      : statusFilteredCars;
    list.innerHTML = filteredCars.map((car) => `
      <button type="button" class="${car.id === selectedId ? "active" : ""}" data-car-id="${car.id}">
        <strong>#${car.number} ${car.name}</strong>
        <small>VIN: ${car.vin || "TBD"}</small>
        <span>${vehicleType(car)} | ${car.status}${car.featured ? " | Featured" : ""}</span>
      </button>
    `).join("") || `<p class="admin-note">No vehicles match these filters.</p>`;
    list.querySelectorAll("button").forEach((button) => {
      button.addEventListener("click", () => {
        const car = carsCache.find((item) => item.id === button.dataset.carId);
        if (car) {
          loadCar(car);
          renderAdminList();
        }
      });
    });
  }

  function escapeHtml(value) {
    return String(value || "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#39;"
    }[character]));
  }

  function formatCount(value) {
    return new Intl.NumberFormat("en-US").format(Number(value) || 0);
  }

  function renderAnalyticsTable(targetId, rows, emptyMessage) {
    const target = document.getElementById(targetId);
    target.innerHTML = `
      <div role="row">
        <span role="columnheader">${targetId === "analytics-vehicles" ? "Vehicle" : "Page"}</span>
        <span role="columnheader">Views</span>
      </div>
      ${rows.length ? rows.map((row) => `
        <div role="row">
          <span role="cell">${escapeHtml(row.label)}</span>
          <strong role="cell">${formatCount(row.count)}</strong>
        </div>
      `).join("") : `
        <div role="row">
          <span role="cell">${emptyMessage}</span>
          <strong role="cell">0</strong>
        </div>
      `}
    `;
  }

  function renderAnalytics(data) {
    const summary = data.summary || {};
    const topVehicle = (data.vehicleViews || [])[0];
    document.getElementById("analytics-range").textContent = data.range || "Last 30 days";
    document.getElementById("analytics-stats").innerHTML = `
      <article>
        <span>Total visits</span>
        <strong>${formatCount(summary.totalVisits)}</strong>
        <small>Page requests</small>
      </article>
      <article>
        <span>Unique visitors</span>
        <strong>${formatCount(summary.uniqueVisitors)}</strong>
        <small>Estimated by IP</small>
      </article>
      <article>
        <span>Vehicle views</span>
        <strong>${formatCount(summary.vehicleViews)}</strong>
        <small>Detail page visits</small>
      </article>
      <article>
        <span>Top car</span>
        <strong>${escapeHtml(topVehicle?.label || "None yet")}</strong>
        <small>${formatCount(topVehicle?.count)} views</small>
      </article>
    `;

    const sources = data.visitorSources || [];
    const visibleSources = locationsExpanded ? sources : sources.slice(0, 5);
    const maxSourceCount = Math.max(...sources.map((source) => source.count), 1);
    document.getElementById("analytics-locations").innerHTML = visibleSources.length ? visibleSources.map((source) => {
      const width = Math.max(8, Math.round((source.count / maxSourceCount) * 100));
      return `
        <div style="--bar: ${width}%">
          <span>${escapeHtml(source.label)}</span>
          <strong>${formatCount(source.count)}</strong>
        </div>
      `;
    }).join("") : `<p class="admin-note">No visitor data yet.</p>`;
    const locationMoreButton = document.getElementById("analytics-locations-more");
    locationMoreButton.hidden = sources.length <= 5;
    locationMoreButton.textContent = locationsExpanded ? "Show less" : `Show more (${sources.length - 5})`;
    locationMoreButton.onclick = () => {
      locationsExpanded = !locationsExpanded;
      renderAnalytics(data);
    };

    renderAnalyticsTable("analytics-vehicles", data.vehicleViews || [], "No vehicle views yet");
    renderAnalyticsTable("analytics-pages", data.topPages || [], "No page views yet");
  }

  async function refreshAnalytics() {
    locationsExpanded = false;
    document.getElementById("analytics-stats").innerHTML = `<article><span>Loading</span><strong>...</strong><small>Reading server logs</small></article>`;
    document.getElementById("analytics-locations").innerHTML = `<p class="admin-note">Loading visitor sources...</p>`;
    document.getElementById("analytics-locations-more").hidden = true;
    renderAnalytics(await api("/api/analytics"));
    analyticsLoaded = true;
  }

  async function showAdminView(view) {
    viewButtons.forEach((button) => button.classList.toggle("active", button.dataset.adminView === view));
    inventoryView.hidden = view !== "inventory";
    analyticsView.hidden = view !== "analytics";
    if (view === "analytics" && !analyticsLoaded) {
      await refreshAnalytics();
    }
  }

  document.getElementById("admin-search").addEventListener("input", (event) => {
    adminSearchTerm = event.target.value.trim().toLowerCase();
    renderAdminList();
  });

  document.querySelectorAll("[data-admin-filter]").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      const allCheckbox = document.querySelector('[data-admin-filter="all"]');
      if (checkbox.dataset.adminFilter === "all") {
        activeStatusFilters = checkbox.checked ? new Set(["all"]) : new Set();
        document.querySelectorAll('[data-admin-filter]:not([data-admin-filter="all"])').forEach((item) => {
          item.checked = false;
        });
      } else {
        if (checkbox.checked) {
          activeStatusFilters.delete("all");
          activeStatusFilters.add(checkbox.dataset.adminFilter);
          allCheckbox.checked = false;
        } else {
          activeStatusFilters.delete(checkbox.dataset.adminFilter);
        }
      }
      if (activeStatusFilters.size === 0) {
        activeStatusFilters = new Set(["all"]);
        allCheckbox.checked = true;
      }
      renderAdminList();
    });
  });

  viewButtons.forEach((button) => {
    button.addEventListener("click", () => {
      showAdminView(button.dataset.adminView);
    });
  });

  async function refreshAdmin() {
    carsCache = normalizeInventory(await getInventory());
    if (!carsCache.some((car) => car.id === selectedId)) selectedId = carsCache[0]?.id || "";
    const car = carsCache.find((item) => item.id === selectedId) || carsCache[0];
    if (car) loadCar(car);
    renderAdminList();
  }

  async function persistAndRefresh(cars, nextSelectedId = selectedId) {
    carsCache = await saveInventory(normalizeInventory(cars));
    selectedId = nextSelectedId;
    await refreshAdmin();
  }

  async function saveCurrentPhotos() {
    carsCache = await saveInventory(carsCache.map((car) => car.id === selectedId ? {
      ...car,
      image: selectedPhotos[0] || defaultVehicleImage,
      photos: selectedPhotos.length ? selectedPhotos : [defaultVehicleImage]
    } : car));
  }

  async function saveCurrentCarfax() {
    carsCache = await saveInventory(carsCache.map((car) => car.id === selectedId ? {
      ...car,
      carfaxImage: fields.carfaxImage.value
    } : car));
  }

  async function uploadImage(file) {
    if (!file) return;
    const form = new FormData();
    form.append("image", file);
    const data = await api("/api/upload", {
      method: "POST",
      body: form
    });
    if (selectedPhotos.length === 1 && selectedPhotos[0] === defaultVehicleImage) {
      selectedPhotos = [];
    }
    selectedPhotos.push(data.path);
    fields.image.value = selectedPhotos[0];
    renderPhotoList();
    await saveCurrentPhotos();
  }

  async function uploadCarfaxImage(file) {
    if (!file) return;
    const form = new FormData();
    form.append("image", file);
    const data = await api("/api/upload", {
      method: "POST",
      body: form
    });
    fields.carfaxImage.value = data.path;
    renderCarfaxPreview();
    await saveCurrentCarfax();
  }

  document.getElementById("admin-login-button").addEventListener("click", async () => {
    const username = document.getElementById("admin-username").value;
    const password = document.getElementById("admin-password").value;
    const message = document.getElementById("admin-login-message");
    try {
      const data = await api("/api/login", {
        method: "POST",
        body: JSON.stringify({ username, password })
      });
      adminToken = data.token;
      message.textContent = "";
      login.hidden = true;
      workspace.hidden = false;
      await refreshAdmin();
      await showAdminView("inventory");
    } catch (error) {
      message.textContent = error.message;
    }
  });

  document.getElementById("admin-new-car").addEventListener("click", async () => {
    const number = nextInventoryNumber(carsCache);
    const car = {
      id: `new-${Date.now()}`,
      number,
      name: "Year Make Model",
      trim: "",
      status: "Coming soon",
      price: "TBD",
      exterior: "TBD",
      interior: "TBD",
      mileage: "TBD",
      vin: "TBD",
      type: "EV",
      image: defaultVehicleImage,
      photos: [defaultVehicleImage],
      carfaxImage: "",
      featured: false,
      description: "Add vehicle details here.",
      highlights: ["Electric vehicle"]
    };
    await persistAndRefresh([...carsCache, car], car.id);
  });

  document.getElementById("admin-delete").addEventListener("click", async () => {
    const remaining = carsCache.filter((car) => car.id !== selectedId);
    await persistAndRefresh(remaining.length ? remaining : fallbackInventory, remaining[0]?.id || fallbackInventory[0].id);
  });

  document.getElementById("admin-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const id = fields.id.value || slugify(fields.name.value);
    const updated = {
      id,
      number: Number(fields.number.value) || nextInventoryNumber(carsCache),
      name: fields.name.value,
      trim: fields.trim.value,
      status: fields.status.value,
      type: fields.type.value,
      price: fields.price.value || "TBD",
      exterior: fields.exterior.value || "TBD",
      interior: fields.interior.value || "TBD",
      mileage: fields.mileage.value || "TBD",
      vin: fields.vin.value || "TBD",
      image: selectedPhotos[0] || fields.image.value || defaultVehicleImage,
      photos: selectedPhotos.length ? selectedPhotos : [fields.image.value || defaultVehicleImage],
      carfaxImage: fields.carfaxImage.value || "",
      featured: fields.featured.checked,
      description: fields.description.value,
      highlights: ["Electric vehicle", fields.exterior.value, fields.interior.value].filter(Boolean)
    };
    const nextCars = carsCache.map((car) => {
      if (car.id === selectedId) return updated;
      return updated.featured ? { ...car, featured: false } : car;
    });
    await persistAndRefresh(nextCars, updated.id);
  });

  fields.upload.addEventListener("change", async () => {
    for (const file of fields.upload.files) {
      await uploadImage(file);
    }
    fields.upload.value = "";
  });

  const drop = document.getElementById("image-drop");
  const carfaxDrop = document.getElementById("carfax-drop");
  drop.addEventListener("click", () => fields.upload.click());
  drop.addEventListener("dragover", (event) => {
    event.preventDefault();
    drop.classList.add("dragging");
  });
  drop.addEventListener("dragleave", () => drop.classList.remove("dragging"));
  drop.addEventListener("drop", async (event) => {
    event.preventDefault();
    drop.classList.remove("dragging");
    for (const file of event.dataTransfer.files) {
      await uploadImage(file);
    }
  });

  fields.carfaxUpload.addEventListener("change", async () => {
    await uploadCarfaxImage(fields.carfaxUpload.files[0]);
    fields.carfaxUpload.value = "";
  });

  carfaxDrop.addEventListener("click", () => fields.carfaxUpload.click());
  carfaxDrop.addEventListener("dragover", (event) => {
    event.preventDefault();
    carfaxDrop.classList.add("dragging");
  });
  carfaxDrop.addEventListener("dragleave", () => carfaxDrop.classList.remove("dragging"));
  carfaxDrop.addEventListener("drop", async (event) => {
    event.preventDefault();
    carfaxDrop.classList.remove("dragging");
    await uploadCarfaxImage(event.dataTransfer.files[0]);
  });
}

setupAdmin();
