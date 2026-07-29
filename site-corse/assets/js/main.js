/* Interactions du site — navigation mobile, visionneuse de galerie, formulaire.
   Vanilla JS, aucun paquet à installer. */

(function () {
  "use strict";

  /* --- Navigation mobile ------------------------------------------------ */
  var bascule = document.querySelector(".nav__bascule");
  var nav = document.getElementById("navigation");

  if (bascule && nav) {
    bascule.addEventListener("click", function () {
      var ouvert = nav.getAttribute("data-ouvert") === "true";
      nav.setAttribute("data-ouvert", String(!ouvert));
      bascule.setAttribute("aria-expanded", String(!ouvert));
    });
  }

  /* --- Visionneuse de galerie ------------------------------------------ */
  var galerie = document.querySelector(".galerie");
  var visionneuse = document.querySelector(".visionneuse");

  if (galerie && visionneuse) {
    var image = visionneuse.querySelector("img");
    var legende = visionneuse.querySelector(".visionneuse__legende");
    var fermer = visionneuse.querySelector(".visionneuse__fermer");
    var declencheur = null;

    galerie.addEventListener("click", function (e) {
      var bouton = e.target.closest("button");
      if (!bouton) return;
      var vignette = bouton.querySelector("img");
      if (!vignette) return;

      declencheur = bouton;
      image.src = vignette.getAttribute("data-grande") || vignette.src;
      image.alt = vignette.alt;
      legende.textContent = vignette.alt;
      visionneuse.setAttribute("data-ouvert", "true");
      fermer.focus();
    });

    var fermerVisionneuse = function () {
      visionneuse.setAttribute("data-ouvert", "false");
      image.removeAttribute("src");
      if (declencheur) declencheur.focus();
    };

    fermer.addEventListener("click", fermerVisionneuse);
    visionneuse.addEventListener("click", function (e) {
      if (e.target === visionneuse) fermerVisionneuse();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && visionneuse.getAttribute("data-ouvert") === "true") {
        fermerVisionneuse();
      }
    });
  }

  /* --- Formulaire de contact ------------------------------------------- */
  /* Par défaut le formulaire n'envoie rien : voir README.md, section
     « Brancher le formulaire de contact ». Tant qu'aucun service n'est
     configuré, on ouvre le client mail du visiteur pour ne pas perdre la
     demande. */
  var formulaire = document.querySelector("[data-formulaire-contact]");

  if (formulaire) {
    formulaire.addEventListener("submit", function (e) {
      var action = formulaire.getAttribute("action");
      if (action && action !== "#") return; // un service est branché : on le laisse faire

      e.preventDefault();
      var donnees = new FormData(formulaire);
      var lignes = [];
      donnees.forEach(function (valeur, cle) {
        if (cle !== "destinataire") lignes.push(cle + " : " + valeur);
      });

      var destinataire = formulaire.getAttribute("data-destinataire") || "";
      var sujet = "Demande de réservation — Maison à louer en Corse";
      window.location.href =
        "mailto:" + destinataire +
        "?subject=" + encodeURIComponent(sujet) +
        "&body=" + encodeURIComponent(lignes.join("\n"));
    });
  }

  /* --- Année courante dans le pied de page ----------------------------- */
  var annee = document.querySelector("[data-annee]");
  if (annee) annee.textContent = String(new Date().getFullYear());
})();
