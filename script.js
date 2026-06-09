/* =========================================================
   Design Tours and Travels
   Clean, human-readable JavaScript
   ========================================================= */

const WHATSAPP_NUMBER = "919405893383";

function whatsappLink(message) {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

const packages = [
  {
    type: "international",
    title: "Dubai Tour Package",
    img: "assets/dubai.jpg",
    desc: "Customised Dubai travel support for families, groups and leisure travellers.",
    places: ["Burj Khalifa", "Dubai Mall", "Desert Safari", "Marina Cruise", "Gold Souk"],
  },
  {
    type: "international",
    title: "Singapore Tour Package",
    img: "assets/singapore.jpg",
    desc: "Modern city attractions, family activities and sightseeing options.",
    places: ["Merlion Park", "Sentosa", "Universal Studios", "Gardens by the Bay", "Singapore Flyer"],
  },
  {
    type: "international",
    title: "Malaysia Tour Package",
    img: "assets/malaysia.png",
    desc: "Kuala Lumpur sightseeing and family-friendly travel assistance.",
    places: ["Petronas Towers", "Batu Caves", "Genting Highlands", "KL Tower", "Putrajaya"],
  },
  {
    type: "international",
    title: "Turkey Tour Package",
    img: "assets/turkey.webp",
    desc: "Historic locations, scenic views and cultural sightseeing support.",
    places: ["Istanbul", "Blue Mosque", "Hagia Sophia", "Bosphorus Cruise", "Cappadocia"],
  },
  {
    type: "international",
    title: "Thailand Tour Package",
    img: "https://images.unsplash.com/photo-1528181304800-259b08848526?w=1200&q=80&auto=format&fit=crop",
    desc: "Popular Thailand packages for families, couples and groups.",
    places: ["Bangkok", "Pattaya", "Phuket", "Krabi", "Coral Island"],
  },
  {
    type: "international",
    title: "Bali Tour Package",
    img: "https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=1200&q=80&auto=format&fit=crop",
    desc: "Beautiful island travel planning with beaches, temples and scenic stays.",
    places: ["Ubud", "Kuta", "Nusa Penida", "Tanah Lot", "Uluwatu"],
  },
  {
    type: "international",
    title: "Maldives Tour Package",
    img: "https://images.unsplash.com/photo-1514282401047-d79a71a590e8?w=1200&q=80&auto=format&fit=crop",
    desc: "Resort, honeymoon and family island package assistance.",
    places: ["Male", "Resort Islands", "Water Villa", "Beach Villa", "Water Sports"],
  },
  {
    type: "international",
    title: "Europe Tour Package",
    img: "assets/europe.jpg",
    desc: "Famous cities, landmarks and scenic travel experiences.",
    places: ["Paris", "Switzerland", "Rome", "Venice", "Amsterdam"],
  },
  {
    type: "international",
    title: "Azerbaijan Tour Package",
    img: "https://images.unsplash.com/photo-1600181982553-ce7eb807de4e?w=1200&q=80&auto=format&fit=crop",
    desc: "Baku and nearby sightseeing options for customised international trips.",
    places: ["Baku", "Nizami Street", "Flame Towers", "Gobustan", "Gabala"],
  },
  {
    type: "domestic",
    title: "Kashmir Tour Package",
    img: "assets/kashmir.jpg",
    desc: "Mountains, gardens, valleys and beautiful local experiences.",
    places: ["Srinagar", "Gulmarg", "Pahalgam", "Sonmarg", "Dal Lake"],
  },
  {
    type: "domestic",
    title: "Kerala Tour Package",
    img: "assets/kerala.jpg",
    desc: "Backwaters, hill stations and peaceful family travel options.",
    places: ["Munnar", "Alleppey", "Thekkady", "Kochi", "Houseboat"],
  },
  {
    type: "domestic",
    title: "Goa Tour Package",
    img: "assets/goa.jpg",
    desc: "Beaches, forts, sightseeing and leisure travel options.",
    places: ["North Goa", "South Goa", "Baga Beach", "Calangute", "Fort Aguada"],
  },
  {
    type: "domestic",
    title: "Manali Tour Package",
    img: "assets/manali.jpg",
    desc: "Mountains, valleys, snow points and adventure experiences.",
    places: ["Solang Valley", "Atal Tunnel", "Hadimba Temple", "Mall Road", "Rohtang"],
  },
  {
    type: "domestic",
    title: "Rajasthan Tour Package",
    img: "https://images.unsplash.com/photo-1599661046827-dacde6976549?w=1200&q=80&auto=format&fit=crop",
    desc: "Royal palaces, desert experiences and heritage sightseeing.",
    places: ["Jaipur", "Udaipur", "Jodhpur", "Jaisalmer", "Mount Abu"],
  },
  {
    type: "domestic",
    title: "Ladakh Tour Package",
    img: "https://images.unsplash.com/photo-1581793745862-99fde7fa73d2?w=1200&q=80&auto=format&fit=crop",
    desc: "Scenic road trips, monasteries, lakes and mountain landscapes.",
    places: ["Leh", "Nubra Valley", "Pangong Lake", "Khardung La", "Shanti Stupa"],
  },
  {
    type: "domestic",
    title: "Andaman Tour Package",
    img: "https://images.unsplash.com/photo-1586500036706-41963de24d8b?w=1200&q=80&auto=format&fit=crop",
    desc: "Island sightseeing, beaches and family holiday assistance.",
    places: ["Port Blair", "Havelock", "Neil Island", "Cellular Jail", "Radhanagar Beach"],
  },
  {
    type: "domestic",
    title: "Himachal Tour Package",
    img: "https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?w=1200&q=80&auto=format&fit=crop",
    desc: "Hill station travel options for couples, families and groups.",
    places: ["Shimla", "Manali", "Kullu", "Dharamshala", "Dalhousie"],
  },
  {
    type: "domestic",
    title: "Delhi Agra Tour Package",
    img: "https://images.unsplash.com/photo-1564507592333-c60657eea523?w=1200&q=80&auto=format&fit=crop",
    desc: "Classic North India sightseeing with monuments and heritage places.",
    places: ["Taj Mahal", "Agra Fort", "India Gate", "Red Fort", "Qutub Minar"],
  },
];

function renderPackages(filter = "international") {
  const slider = document.getElementById("packageSlider");
  if (!slider) return;

  const visiblePackages = packages.filter((item) => item.type === filter);

  slider.innerHTML = visiblePackages
    .map((item) => {
      const placesHtml = item.places.map((place) => `<span>${place}</span>`).join("");
      const packageMessage = `Hello Design Tours and Travels, I want details for ${item.title}.\n\nPackage type: Customised Package\nNo. of travellers: \nPreferred travel month: \nDeparture city: \nHotel preference: \nBudget range: `;

      return `
        <article class="package-card" data-type="${item.type}">
          <div
            class="package-img"
            style="background-image: url('${item.img}'); background-position: center center;"
          >
            <span class="pkg-badge">${item.type}</span>
          </div>

          <div class="package-body">
            <h3>${item.title}</h3>
            <p>${item.desc}</p>

            <div class="meta">
              <span>Contact for Price</span>
              <span>Customised Package</span>
            </div>

            <div class="places">${placesHtml}</div>

            <a
              class="btn btn-primary"
              target="_blank"
              href="${whatsappLink(packageMessage)}"
            >
              Get Package Details
            </a>
          </div>
        </article>
      `;
    })
    .join("");
}

function setupPackageFilters() {
  document.querySelectorAll(".filter-btn").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".filter-btn").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      renderPackages(button.dataset.filter);
    });
  });
}

function setMode(mode) {
  const isHajMode = mode === "haj";

  document.body.classList.toggle("haj-mode", isHajMode);
  document.body.classList.toggle("tours-mode", !isHajMode);

  document.getElementById("toursPanel")?.classList.toggle("active", !isHajMode);
  document.getElementById("hajPanel")?.classList.toggle("active", isHajMode);

  document.querySelectorAll(".switch-btn").forEach((button) => {
    button.classList.remove("active");
  });

  document.querySelectorAll(`.switch-btn.${mode}`).forEach((button) => {
    button.classList.add("active");
  });

  document.documentElement.style.scrollBehavior = "auto";
  window.scrollTo(0, 0);

  setTimeout(() => {
    document.documentElement.style.scrollBehavior = "smooth";
    observeReveal();
  }, 80);
}

function setupModeButtons() {
  document.querySelectorAll("[data-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      setMode(button.dataset.mode);
      document.getElementById("mobileMenu")?.classList.add("hidden");
    });
  });
}

function setupMobileMenu() {
  const button = document.getElementById("mobileMenuBtn");
  const menu = document.getElementById("mobileMenu");

  button?.addEventListener("click", () => {
    menu?.classList.toggle("hidden");
  });
}

function observeReveal() {
  document.querySelectorAll(".reveal").forEach((element) => {
    const rect = element.getBoundingClientRect();

    if (rect.top < window.innerHeight - 70) {
      element.classList.add("visible");
    }
  });
}

function setupLoader() {
  const loader = document.getElementById("loader");

  window.addEventListener("load", () => {
    setTimeout(() => loader?.classList.add("hide"), 1450);
    observeReveal();
  });

  // Safety fallback for slow browsers or cached asset issues.
  setTimeout(() => loader?.classList.add("hide"), 1800);
}

function setupQuickTripEnquiry() {
  const button = document.getElementById("quickTripBtn");
  if (!button) return;

  button.addEventListener("click", () => {
    const destination = document.getElementById("quickDestination")?.value.trim() || "";
    const travelType = document.getElementById("quickTravelType")?.value.trim() || "";
    const travellers = document.getElementById("quickTravellers")?.value.trim() || "";

    const text = `Hello Design Tours and Travels,
I want package details for a customised trip.

Destination: ${destination}
Travel type: ${travelType}
No. of travellers: ${travellers}
Preferred travel month: 
Departure city: 
Budget range: 

Please share package options and contact-for-price details.`;

    window.open(whatsappLink(text), "_blank");
  });
}

function setupEnquiryForm() {
  const form = document.getElementById("enquiryForm");
  const successMessage = document.getElementById("successMsg");

  if (!form) return;

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const name = document.getElementById("name")?.value.trim() || "";
    const phone = document.getElementById("phone")?.value.trim() || "";
    const service = document.getElementById("service")?.value.trim() || "";
    const destination = document.getElementById("destination")?.value.trim() || "";
    const message = document.getElementById("message")?.value.trim() || "";

    const text = `Hello Design Tours and Travels, I want to enquire about a customised travel package.\n\nName: ${name}\nPhone: ${phone}\nService needed: ${service}\nDestination: ${destination}\nNo. of travellers / message: ${message}\n\nPlease share package options and contact-for-price details.`;

    successMessage.style.display = "block";
    window.open(whatsappLink(text), "_blank");

    form.reset();
    setTimeout(() => {
      successMessage.style.display = "none";
    }, 3500);
  });
}

renderPackages("international");
setupPackageFilters();
setupModeButtons();
setupMobileMenu();
setupLoader();
setupEnquiryForm();
setupQuickTripEnquiry();

window.addEventListener("scroll", observeReveal);
observeReveal();
