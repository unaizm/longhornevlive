let adminToken = "";
let carsCache = [];
const defaultVehicleImage = "assets/model-3-2021-white.png";

const fallbackInventory = [
  {
    id: "2021-tesla-model-3-long-range",
    number: 1,
    name: "2021 Tesla Model 3",
    trim: "Long Range",
    status: "Coming soon",
    price: "TBD",
    exterior: "White",
    interior: "Black",
    mileage: "TBD",
    vin: "TBD",
    type: "EV",
    image: defaultVehicleImage,
    photos: [defaultVehicleImage],
    carfaxImage: "",
    featured: true,
    description: "A clean electric sedan with a minimalist cabin, strong range, and the modern driving feel Longhorn EV is built around.",
    highlights: ["Long Range", "All-electric", "Premium interior", "Fast charging capable"]
  }
];

async function api(path, options = {}) {
  const headers = {
    ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
    ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {}),
    ...(options.headers || {})
  };
  const response = await fetch(path, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}

async function getInventory() {
  try {
    const data = await api("/api/inventory");
    return data.cars || fallbackInventory;
  } catch {
    return fallbackInventory;
  }
}

async function saveInventory(cars) {
  const data = await api("/api/inventory", {
    method: "POST",
    body: JSON.stringify({ cars })
  });
  carsCache = data.cars || cars;
  return carsCache;
}

function normalizeInventory(cars) {
  return cars.map((car, index) => ({
    number: index + 1,
    ...car,
    trim: car.trim || "",
    photos: getCarPhotos(car),
    image: getCarPhotos(car)[0],
    carfaxImage: car.carfaxImage || "",
    featured: Boolean(car.featured),
    vin: car.vin || "TBD",
    type: car.type || "EV"
  }));
}

function getCarPhotos(car) {
  const photos = Array.isArray(car.photos) ? car.photos.filter(Boolean) : [];
  if (car.image && !photos.includes(car.image)) photos.unshift(car.image);
  return photos.length ? photos : [defaultVehicleImage];
}

function nextInventoryNumber(cars) {
  return cars.reduce((highest, car) => Math.max(highest, Number(car.number) || 0), 0) + 1;
}

function slugify(value) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `car-${Date.now()}`;
}

function formatPrice(price) {
  const value = String(price || "TBD").trim();
  if (!value || value.toLowerCase() === "tbd") return "TBD";
  return value.startsWith("$") ? value : `$${value}`;
}

function absoluteUrl(path) {
  return new URL(path, "https://longhornev.com/").href;
}

function setMeta(selector, attributes) {
  let element = document.head.querySelector(selector);
  if (!element) {
    element = document.createElement("meta");
    document.head.appendChild(element);
  }
  Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, value));
}

function setVehicleMetadata(car, photos) {
  const fullName = [car.name, car.trim].filter(Boolean).join(" ");
  const canonicalUrl = `https://longhornev.com/vehicle.html?id=${encodeURIComponent(car.id)}`;
  const description = `View this used ${fullName} with ${car.mileage || "mileage available on request"} at Longhorn EV, an Austin-area dealership serving buyers across Texas. See photos, price, VIN, and vehicle details.`;
  const imageUrl = absoluteUrl(photos[0]);
  const price = String(car.price || "").replace(/[^0-9.]/g, "");
  const mileage = Number(String(car.mileage || "").replace(/[^0-9]/g, ""));

  document.title = `${fullName} for Sale in Austin, TX | Longhorn EV`;
  setMeta('meta[name="description"]', { name: "description", content: description });
  setMeta('meta[property="og:title"]', { property: "og:title", content: document.title });
  setMeta('meta[property="og:description"]', { property: "og:description", content: description });
  setMeta('meta[property="og:url"]', { property: "og:url", content: canonicalUrl });
  setMeta('meta[property="og:image"]', { property: "og:image", content: imageUrl });

  let canonical = document.head.querySelector('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement("link");
    canonical.rel = "canonical";
    document.head.appendChild(canonical);
  }
  canonical.href = canonicalUrl;

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Vehicle",
    name: fullName,
    description: car.description || description,
    url: canonicalUrl,
    image: photos.map(absoluteUrl),
    color: car.exterior || undefined,
    vehicleInteriorColor: car.interior || undefined,
    vehicleIdentificationNumber: car.vin && car.vin !== "TBD" ? car.vin : undefined,
    mileageFromOdometer: mileage
      ? { "@type": "QuantitativeValue", value: mileage, unitCode: "SMI" }
      : undefined,
    offers: price
      ? {
          "@type": "Offer",
          price,
          priceCurrency: "USD",
          availability: String(car.status || "").toLowerCase().includes("available")
            ? "https://schema.org/InStock"
            : "https://schema.org/PreOrder",
          url: canonicalUrl,
          seller: { "@id": "https://longhornev.com/#dealership" }
        }
      : undefined
  };
  let script = document.getElementById("vehicle-structured-data");
  if (!script) {
    script = document.createElement("script");
    script.id = "vehicle-structured-data";
    script.type = "application/ld+json";
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify(structuredData);
}

function trimMarkup(car) {
  return car.trim ? `<p class="vehicle-trim">${car.trim}</p>` : "";
}

function vehicleType(car) {
  return String(car.type || "EV").toLowerCase().includes("non") ? "Non-EV" : "EV";
}

function carCard(car, featured = false) {
  const statusClass = car.status.toLowerCase().includes("available") ? "available" : "";
  const photos = getCarPhotos(car);
  const image = photos[0];
  const carfaxMarkup = car.carfaxImage
    ? `<a class="carfax-link" href="${car.carfaxImage}" target="_blank" rel="noopener" aria-label="Open Carfax for ${car.name}">Carfax</a>`
    : `<span class="carfax-link disabled" aria-disabled="true">Carfax</span>`;
  return `
    <article class="vehicle-card dealer-card" data-href="vehicle.html?id=${encodeURIComponent(car.id)}" role="link" tabindex="0" aria-label="View ${car.name}">
      <div class="vehicle-media" data-photos="${photos.join("|")}" data-photo-index="0" ${photos.length > 1 ? 'tabindex="0"' : ""}>
        <img src="${image}" alt="${car.name}">
        ${photos.length > 1 ? `
          <button class="photo-arrow photo-arrow-prev" type="button" aria-label="Previous photo">‹</button>
          <button class="photo-arrow photo-arrow-next" type="button" aria-label="Next photo">›</button>
        ` : ""}
        <span class="status-pill ${statusClass}">${car.status}</span>
      </div>
      <div class="vehicle-details">
        <div class="vehicle-card-heading">
          <div>
            <h2>${car.name}</h2>
            ${trimMarkup(car)}
          </div>
          <strong class="vehicle-price">${formatPrice(car.price)}</strong>
        </div>
        <dl class="specs" aria-label="${car.name} details">
          <div>
            <dt>Mileage</dt>
            <dd>${car.mileage}</dd>
          </div>
          <div>
            <dt>Exterior / Interior</dt>
            <dd>${car.exterior} / ${car.interior}</dd>
          </div>
          ${featured ? "" : `<div>
            <dt>VIN</dt>
            <dd>${car.vin || "TBD"}</dd>
          </div>`}
          ${featured ? "" : `<div>
            <dt>Type</dt>
            <dd>${vehicleType(car)}</dd>
          </div>`}
        </dl>
        <div class="vehicle-card-actions">
          ${carfaxMarkup}
          <span class="book-link">View Details</span>
        </div>
      </div>
    </article>
  `;
}

function setupVehicleCards(scope = document) {
  scope.querySelectorAll(".vehicle-card[data-href]").forEach((card) => {
    card.addEventListener("click", (event) => {
      if (event.target.closest("a, button")) return;
      window.location.href = card.dataset.href;
    });
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter") window.location.href = card.dataset.href;
    });
  });
  setupPhotoArrows(scope);
}

function setupPhotoArrows(scope = document) {
  scope.querySelectorAll(".vehicle-media[data-photos], .vehicle-detail-media[data-photos]").forEach((media) => {
    const photos = media.dataset.photos.split("|").filter(Boolean);
    if (photos.length < 2) return;
    const image = media.querySelector("img");
    const updatePhoto = (direction) => {
      const current = Number(media.dataset.photoIndex) || 0;
      const next = (current + direction + photos.length) % photos.length;
      media.dataset.photoIndex = String(next);
      image.src = photos[next];
    };
    media.querySelector(".photo-arrow-prev")?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      updatePhoto(-1);
    });
    media.querySelector(".photo-arrow-next")?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      updatePhoto(1);
    });
    media.addEventListener("keydown", (event) => {
      if (event.key === "ArrowLeft") updatePhoto(-1);
      if (event.key === "ArrowRight") updatePhoto(1);
    });
  });
}

async function renderFeatured() {
  const target = document.getElementById("featured-vehicle");
  if (!target) return;
  const cars = await getInventory();
  const car = cars.find((item) => item.featured) || cars[0];
  target.innerHTML = carCard(car, true);
  setupVehicleCards(target);
}

async function renderInventory() {
  const target = document.getElementById("inventory-list");
  if (!target) return;
  const cars = await getInventory();
  const search = document.getElementById("inventory-search");
  const evFilter = document.getElementById("inventory-filter-ev");
  const nonEvFilter = document.getElementById("inventory-filter-non-ev");
  const selectedType = new URLSearchParams(location.search).get("type");
  if (evFilter) evFilter.checked = selectedType !== "non-ev";
  if (nonEvFilter) nonEvFilter.checked = selectedType === "non-ev";
  const filterCars = () => {
    const term = (search?.value || "").trim().toLowerCase();
    const typeFilters = [];
    if (evFilter?.checked) typeFilters.push("EV");
    if (nonEvFilter?.checked) typeFilters.push("Non-EV");
    const filteredCars = cars.filter((car) => {
      const matchesType = !typeFilters.length || typeFilters.includes(vehicleType(car));
      const searchable = [
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
        ].join(" ").toLowerCase();
      return matchesType && (!term || searchable.includes(term));
    });
    target.innerHTML = filteredCars.map((car) => carCard(car)).join("") || `<p class="inventory-empty-message">No vehicles match your search.</p>`;
    setupVehicleCards(target);
  };
  search?.addEventListener("input", filterCars);
  evFilter?.addEventListener("change", filterCars);
  nonEvFilter?.addEventListener("change", filterCars);
  filterCars();
}

async function renderVehicleDetail() {
  const target = document.getElementById("vehicle-detail");
  if (!target) return;
  const id = new URLSearchParams(location.search).get("id");
  const cars = await getInventory();
  const car = cars.find((item) => item.id === id) || cars[0];
  const photos = getCarPhotos(car);
  setVehicleMetadata(car, photos);
  target.innerHTML = `
    <div class="vehicle-detail-layout">
      <div class="vehicle-detail-media" data-photos="${photos.join("|")}" data-photo-index="0" tabindex="0">
        <img src="${photos[0]}" alt="${car.name}">
        ${photos.length > 1 ? `
          <button class="photo-arrow photo-arrow-prev" type="button" aria-label="Previous photo">‹</button>
          <button class="photo-arrow photo-arrow-next" type="button" aria-label="Next photo">›</button>
          <div class="vehicle-photo-strip">${photos.map((photo, index) => `<button type="button" data-photo-index="${index}" aria-label="Show photo ${index + 1}"><img src="${photo}" alt="${car.name} photo"></button>`).join("")}</div>
        ` : ""}
      </div>
      <div class="vehicle-detail-copy">
        <p class="eyebrow">${car.status}</p>
        <div class="vehicle-detail-heading">
          <div>
            <h1>${car.name}</h1>
            ${trimMarkup(car)}
          </div>
          <strong class="vehicle-price">${formatPrice(car.price)}</strong>
        </div>
        <p class="lede">${car.description}</p>
        <dl class="detail-specs">
          <div><dt>Mileage</dt><dd>${car.mileage}</dd></div>
          <div><dt>Exterior / Interior</dt><dd>${car.exterior} / ${car.interior}</dd></div>
          <div><dt>VIN</dt><dd>${car.vin || "TBD"}</dd></div>
          <div><dt>Type</dt><dd>${vehicleType(car)}</dd></div>
          <div><dt>Status</dt><dd>${car.status}</dd></div>
        </dl>
        ${car.carfaxImage ? `<a class="carfax-detail-link" href="${car.carfaxImage}" target="_blank" rel="noopener">Carfax</a>` : `<span class="carfax-detail-link disabled" aria-disabled="true">Carfax</span>`}
        <a class="book-link" href="tel:5129001036">Purchase</a>
      </div>
    </div>
  `;
  setupPhotoArrows(target);
  target.querySelectorAll(".vehicle-photo-strip button").forEach((button) => {
    button.addEventListener("click", () => {
      const media = target.querySelector(".vehicle-detail-media");
      const image = media.querySelector("img");
      const photos = media.dataset.photos.split("|").filter(Boolean);
      const index = Number(button.dataset.photoIndex) || 0;
      media.dataset.photoIndex = String(index);
      image.src = photos[index];
    });
  });
}

renderFeatured();
renderInventory();
renderVehicleDetail();
