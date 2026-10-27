/* ============================================================================
   config.js  —  App-wide constants and settings.
   Safe to edit by hand. Non-technical? The two lines you may want to change are
   DEFAULT_ORG_NAME and DEFAULT_ORG_TAGLINE just below.
   ========================================================================== */
(function () {
  "use strict";
  const NIDSG = (window.NIDSG = window.NIDSG || {});

  NIDSG.config = {
    // ---- Branding (also editable inside the app on the "Data" tab) -----------
    DEFAULT_ORG_NAME: "NIDSG",
    DEFAULT_ORG_TAGLINE: "Attendance Register",

    // ---- Storage -------------------------------------------------------------
    DB_NAME: "nidsg-attendance",
    DB_VERSION: 1,

    // ---- Behaviour -----------------------------------------------------------
    // Remind to back up if it has been this many days since the last backup.
    BACKUP_REMINDER_DAYS: 7,

    // ---- Reference lists -----------------------------------------------------
    // Nigeria: 36 states + Federal Capital Territory (Abuja).
    STATES: [
      "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue",
      "Borno", "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu",
      "FCT (Abuja)", "Gombe", "Imo", "Jigawa", "Kaduna", "Kano", "Katsina",
      "Kebbi", "Kogi", "Kwara", "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo",
      "Osun", "Oyo", "Plateau", "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara"
    ],

    // Common Nigerian titles — offered as suggestions, but any title can be typed.
    TITLES: [
      "Mr", "Mrs", "Miss", "Ms", "Dr", "Prof", "Chief", "Engr", "Barr", "Hon",
      "Pastor", "Rev", "Rev Dr", "Elder", "Deacon", "Deaconess", "Alhaji",
      "Alhaja", "Mallam", "Otunba", "Sir", "Lady"
    ],

    GENDERS: ["Female", "Male", "Unspecified"]
  };
})();
