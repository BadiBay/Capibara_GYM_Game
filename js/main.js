/* ═══════════════════════════════════════════════════════
   ASSETS
   ═══════════════════════════════════════════════════════ */
const CAPY_IMAGES = {};
for (let i = 1; i <= 9; i++) {
  CAPY_IMAGES[i] = { full: new Image(), bg: new Image(), hasFull: false, hasBg: false };
}

const fullTiers = [
  { t: 1, folder: 'capi_noodle_1', file: 'noodles.webp' },
  { t: 2, folder: 'capi_noob_2', file: 'noob.webp' },
  { t: 3, folder: 'capi_toned_3', file: 'toned.webp' },
  { t: 4, folder: 'capi_jock_4', file: 'jock.webp' },
  { t: 5, folder: 'capi_athlete_5', file: 'athlete.webp' },
  { t: 6, folder: 'capi_bodybuilder_6', file: 'bodybuilder.webp' },
  { t: 7, folder: 'capi_mr.olimpia_7', file: 'mr.olympia.webp' },
  { t: 8, folder: 'capi_gigachad_8', file: 'gigachad.webp' },
  { t: 9, folder: 'capi_god_9', file: 'god_v2.webp' }
];
fullTiers.forEach(ft => {
  CAPY_IMAGES[ft.t].full.src = `images/${ft.folder}/${ft.file}`;
  CAPY_IMAGES[ft.t].hasFull = true;
});

CAPY_IMAGES[9].bg.src = 'images/capi_god_9/god_bg.webp';
CAPY_IMAGES[9].hasBg = true;

const SKIN_IMAGES = {};
const skinNames = ['alien', 'cool', 'demon', 'kiborg', 'king'];
const tierToSkinMap = {
  1: 'noodle', 2: 'noob', 3: 'toned', 4: 'jork', 5: 'athlete',
  6: 'bodybuilder', 7: 'mr_olimpia', 8: 'gigachad', 9: 'god'
};
skinNames.forEach(skin => {
  SKIN_IMAGES[skin] = {};
  Object.keys(tierToSkinMap).forEach(t => {
    SKIN_IMAGES[skin][t] = new Image();
    SKIN_IMAGES[skin][t].src = `images/skins/${skin}/skin-${tierToSkinMap[t]}-${skin}.webp`;
  });
});

/* ═══════════════════════════════════════════════════════
   YANDEX GAMES SDK
   ═══════════════════════════════════════════════════════ */
let ysdk = null;
let player = null;
let leaderboards = null;
let payments = null;
let lastAdTime = 0;

window.isAdPlaying = false;
function onAdOpen() {
  window.isAdPlaying = true;
  pauseBgMusic();
}
function onAdClose() {
  window.isAdPlaying = false;
  if (state.musicVolume > 0) playBgMusic();
}

function showInterstitialAd() {
  if (state.noAds) return;
  if (ysdk && ysdk.adv) {
    const now = Date.now();
    if (now - lastAdTime > 3 * 60 * 1000) { // 3 min cooldown
      ysdk.adv.showFullscreenAdv({
        callbacks: {
          onOpen: function () { onAdOpen(); },
          onClose: function (wasShown) { lastAdTime = Date.now(); onAdClose(); },
          onError: function (error) { onAdClose(); }
        }
      });
    }
  }
}

function initYandexSDK() {
  if (typeof YaGames !== 'undefined') {
    YaGames.init().then(res => {
      ysdk = res;
      ysdk.features.LoadingAPI?.ready();
      ysdk.features.GameplayAPI?.start();

      // Обработка системной паузы (для модерации)
      if (ysdk.onEvent) {
        ysdk.onEvent(ysdk.EVENTS.EXIT, () => {
          if (musicIsPlaying) {
            pauseBgMusic();
            window._bgMusicWasPlaying = true;
          }
        });
      }
      if (ysdk.on) {
        ysdk.on('game_api_pause', () => {
          if (musicIsPlaying) {
            pauseBgMusic();
            window._bgMusicWasPlaying = true;
          }
        });
        ysdk.on('game_api_resume', () => {
          if (window._bgMusicWasPlaying && state.musicVolume > 0 && !window.isAdPlaying) {
            playBgMusic();
            window._bgMusicWasPlaying = false;
          }
        });
      }

      if (ysdk.environment && ysdk.environment.i18n && ysdk.environment.i18n.lang) {
        let envLang = ysdk.environment.i18n.lang;
        if (envLang === 'ru' || envLang === 'be' || envLang === 'kk' || envLang === 'uk' || envLang === 'uz') {
          currentLang = 'ru';
        } else {
          currentLang = 'en';
        }
        document.documentElement.lang = currentLang;
        translateUI();
        if (typeof updateUI === 'function') updateUI();
        if (typeof renderShop === 'function') renderShop(true);
        if (typeof renderQuests === 'function') renderQuests();
        if (typeof renderAchievements === 'function') renderAchievements();
        if (typeof renderWardrobe === 'function') renderWardrobe();
        if (typeof renderLocations === 'function') renderLocations();
        if (typeof renderPrestigeTree === 'function') renderPrestigeTree();
        if (typeof renderDailyRewards === 'function') renderDailyRewards();
        if (typeof renderBattlePass === 'function') renderBattlePass();
        if (typeof renderDonateShop === 'function') renderDonateShop();
        if (typeof renderStats === 'function') renderStats();
        if (typeof checkTier === 'function') checkTier();
      }

      // Show rewarded btn if available
      document.getElementById('rewarded-ad-btn').style.display = 'block';

      // Show first ad
      setTimeout(() => showInterstitialAd(), 2000);

      ysdk.getPlayer({ scopes: false }).then(_player => {
        player = _player;
        if (player.getMode() === 'lite') {
          const authBtn = document.getElementById('auth-btn');
          const authDesc = document.getElementById('auth-desc');
          if (authBtn) authBtn.style.display = 'block';
          if (authDesc) authDesc.style.display = 'block';
        }
        loadGame(); // Reload from cloud if available
      }).catch(err => {
        console.error('Player error:', err);
      });

      // Правильная инициализация лидербордов в Yandex SDK v2
      if (ysdk.getLeaderboards) {
        ysdk.getLeaderboards().then(_lb => {
          leaderboards = _lb;
        }).catch(err => console.error('Leaderboard error:', err));
      }

      // Инициализация платежей
      ysdk.getPayments({ signed: false }).then(_payments => {
        payments = _payments;
        
        // Получение каталога товаров для соответствия правилам модерации (динамическая цена/валюта)
        payments.getCatalog().then(products => {
            window.catalogProducts = products;
            if (typeof renderDonateShop === 'function') renderDonateShop();
        }).catch(err => console.error('getCatalog error:', err));

        // Проверка необработанных покупок (обязательно для модерации)
        payments.getPurchases().then(purchases => {
            purchases.forEach(purchase => {
                let shouldConsume = false;
                
                if (purchase.productID === 'premium_bp') {
                    if (!state.hasPremiumBP) state.hasPremiumBP = true;
                    shouldConsume = true;
                } else if (purchase.productID === 'no_ads') {
                    if (!state.noAds) state.noAds = true;
                    shouldConsume = true;
                } else if (purchase.productID === 'gems_100') {
                    state.gems += 100;
                    if (typeof showToast === 'function' && typeof t === 'function') showToast(t('toast_gems_100'));
                    shouldConsume = true;
                } else if (purchase.productID === 'starter_pack') {
                    state.gems += 100;
                    state.prestigeCoins += 1;
                    if (typeof showToast === 'function' && typeof t === 'function') showToast(t('toast_starter_pack'));
                    shouldConsume = true;
                }

                if (shouldConsume) {
                    saveGame();
                    if (typeof updateUI === 'function') updateUI();
                    if (typeof renderBattlePass === 'function') renderBattlePass();
                    if (typeof renderDonateShop === 'function') renderDonateShop();
                    payments.consumePurchase(purchase.purchaseToken).catch(e => console.error(e));
                }
            });
        }).catch(err => console.error('getPurchases error:', err));
      }).catch(err => console.error('Payments error:', err));

    }).catch(e => {
      console.error('Yandex SDK Init Error', e);
    });
  } else {
    console.log('Running locally without Yandex SDK');
  }
}

/* ═══════════════════════════════════════════════════════
   LOCATIONS
   ═══════════════════════════════════════════════════════ */
const GP_ICON = '<img src="images/GP.webp" style="height: 1em; vertical-align: middle; transform: translateY(-0.15em);">';
const LOCATIONS = [
  { id: 'bedroom', get name() { return t('loc_bedroom_name'); }, get desc() { return t('loc_bedroom_desc'); }, multiplier: 1, reqTier: 1, bgImage: 'url("images/backgrounds/Static/The_Bedroom.webp")' },
  { id: 'playground', get name() { return t('loc_playground_name'); }, get desc() { return t('loc_playground_desc') + ' x1.5 ' + GP_ICON; }, multiplier: 1.5, reqTier: 2, bgImage: 'url("images/backgrounds/Static/Outdoor_Playground.webp")' },
  { id: 'basement', get name() { return t('loc_basement_name'); }, get desc() { return t('loc_basement_desc') + ' x2.5 ' + GP_ICON; }, multiplier: 2.5, reqTier: 3, bgImage: 'url("images/backgrounds/Static/basement.webp")' },
  { id: 'elite', get name() { return t('loc_elite_name'); }, get desc() { return t('loc_elite_desc') + ' x4 ' + GP_ICON; }, multiplier: 4, reqTier: 4, bgImage: 'none', video: 'images/backgrounds/Animated/bg-elite.mp4' },
  { id: 'beach', get name() { return t('loc_beach_name'); }, get desc() { return t('loc_beach_desc') + ' x6 ' + GP_ICON; }, multiplier: 6, reqTier: 5, bgImage: 'none', video: 'images/backgrounds/Animated/bg-beach.mp4' },
  { id: 'everest', get name() { return t('loc_everest_name'); }, get desc() { return t('loc_everest_desc') + ' x9 ' + GP_ICON; }, multiplier: 9, reqTier: 6, bgImage: 'none', video: 'images/backgrounds/Animated/bg-Mount_Everest.mp4' },
  { id: 'space', get name() { return t('loc_space_name'); }, get desc() { return t('loc_space_desc') + ' x13 ' + GP_ICON; }, multiplier: 13, reqTier: 7, bgImage: 'none', video: 'images/backgrounds/Animated/bg-space.mp4' },
  { id: 'temple', get name() { return t('loc_temple_name'); }, get desc() { return t('loc_temple_desc') + ' x18 ' + GP_ICON; }, multiplier: 18, reqTier: 8, bgImage: 'none', video: 'images/backgrounds/Animated/bg-The_Dark_Temple.mp4' },
  { id: 'astral', get name() { return t('loc_astral_name'); }, get desc() { return t('loc_astral_desc') + ' x25 ' + GP_ICON; }, multiplier: 25, reqTier: 9, bgImage: 'none', video: 'images/backgrounds/Animated/BG-The_Astral_Dimension.mp4' },
];

/* ═══════════════════════════════════════════════════════
   BOSSES (TOURNAMENTS)
   ═══════════════════════════════════════════════════════ */
const BOSSES = [
  { level: 1, get name() { return t('boss_1_name'); }, hp: 25000, reward: 2 },
  { level: 2, get name() { return t('boss_2_name'); }, hp: 5000000, reward: 5 },
  { level: 3, get name() { return t('boss_3_name'); }, hp: 500000000, reward: 10 },
  { level: 4, get name() { return t('boss_4_name'); }, hp: 100000000000, reward: 25 },
  { level: 5, get name() { return t('boss_5_name'); }, hp: 25000000000000, reward: 50 },
];
let currentTournament = null;

const SHOP_UPGRADES = [
  { id: 'click', get name() { return t('shop_click_name'); }, icon: '🏋️', get desc() { return t('shop_click_desc'); }, baseCost: 50, type: 'click', btnClass: 'green' },
  { id: 'titanium', get name() { return t('shop_titanium_name'); }, icon: '💪', get desc() { return t('shop_titanium_desc'); }, baseCost: 2500, type: 'click', btnClass: 'green' },
  { id: 'alien', get name() { return t('shop_alien_name'); }, icon: '🛸', get desc() { return t('shop_alien_desc'); }, baseCost: 75000, type: 'click', btnClass: 'green' },
  { id: 'neutron', get name() { return t('shop_neutron_name'); }, icon: '🤖', get desc() { return t('shop_neutron_desc'); }, baseCost: 5000000, type: 'click', btnClass: 'green' },
  { id: 'alien2', get name() { return t('shop_alien2_name'); }, icon: '👽', get desc() { return t('shop_alien2_desc'); }, baseCost: 500000000, type: 'click', btnClass: 'green' },
  { id: 'god', get name() { return t('shop_god_name'); }, icon: '⚡', get desc() { return t('shop_god_desc'); }, baseCost: 75000000000, type: 'click', btnClass: 'green' },
  { id: 'titan', get name() { return t('shop_titan_name'); }, icon: '🗿', get desc() { return t('shop_titan_desc'); }, baseCost: 8000000000000, type: 'click', btnClass: 'green' },
  { id: 'demigod', get name() { return t('shop_demigod_name'); }, icon: '🦸', get desc() { return t('shop_demigod_desc'); }, baseCost: 1000000000000000, type: 'click', btnClass: 'green' },
  { id: 'universe_creator', get name() { return t('shop_universe_creator_name'); }, icon: '✨', get desc() { return t('shop_universe_creator_desc'); }, baseCost: 150000000000000000, type: 'click', btnClass: 'green' },
  { id: 'reality_bender', get name() { return t('shop_reality_bender_name'); }, icon: '🧿', get desc() { return t('shop_reality_bender_desc'); }, baseCost: 25000000000000000000, type: 'click', btnClass: 'green' },
  { id: 'absolute_power', get name() { return t('shop_absolute_power_name'); }, icon: '🔱', get desc() { return t('shop_absolute_power_desc'); }, baseCost: 5000000000000000000000, type: 'click', btnClass: 'green' },

  { id: 'auto', get name() { return t('shop_auto_name'); }, icon: '⚡', get desc() { return t('shop_auto_desc') + ' ' + GP_ICON + '/sec.'; }, baseCost: 100, type: 'auto', btnClass: 'pink' },
  { id: 'shake', get name() { return t('shop_shake_name'); }, icon: '🥤', get desc() { return t('shop_shake_desc') + ' ' + GP_ICON + '/sec.'; }, baseCost: 1500, type: 'auto', btnClass: 'pink' },
  { id: 'bro', get name() { return t('shop_bro_name'); }, icon: '👨‍🦲', get desc() { return t('shop_bro_desc') + ' ' + GP_ICON + '/sec.'; }, baseCost: 18000, type: 'auto', btnClass: 'pink' },
  { id: 'trainer', get name() { return t('shop_trainer_name'); }, icon: '📋', get desc() { return t('shop_trainer_desc') + ' ' + GP_ICON + '/sec.'; }, baseCost: 250000, type: 'auto', btnClass: 'pink' },
  { id: 'sponsor', get name() { return t('shop_sponsor_name'); }, icon: '🤝', get desc() { return t('shop_sponsor_desc') + ' ' + GP_ICON + '/sec.'; }, baseCost: 4000000, type: 'auto', btnClass: 'pink' },
  { id: 'chain', get name() { return t('shop_chain_name'); }, icon: '🏢', get desc() { return t('shop_chain_desc') + ' ' + GP_ICON + '/sec.'; }, baseCost: 80000000, type: 'auto', btnClass: 'pink' },
  { id: 'corp', get name() { return t('shop_corp_name'); }, icon: '📈', get desc() { return t('shop_corp_desc') + ' ' + GP_ICON + '/sec.'; }, baseCost: 2000000000, type: 'auto', btnClass: 'pink' },
  { id: 'monopoly', get name() { return t('shop_monopoly_name'); }, icon: '👑', get desc() { return t('shop_monopoly_desc') + ' ' + GP_ICON + '/sec.'; }, baseCost: 60000000000, type: 'auto', btnClass: 'pink' },

  { id: 'planet_gym', get name() { return t('shop_planet_gym_name'); }, icon: '🪐', get desc() { return t('shop_planet_gym_desc') + ' ' + GP_ICON + '/sec.'; }, baseCost: 2000000000000, type: 'auto', btnClass: 'pink' },
  { id: 'galaxy_gym', get name() { return t('shop_galaxy_gym_name'); }, icon: '🌌', get desc() { return t('shop_galaxy_gym_desc') + ' ' + GP_ICON + '/sec.'; }, baseCost: 80000000000000, type: 'auto', btnClass: 'pink' },
  { id: 'multiverse_gym', get name() { return t('shop_multiverse_gym_name'); }, icon: '🌀', get desc() { return t('shop_multiverse_gym_desc') + ' ' + GP_ICON + '/sec.'; }, baseCost: 4000000000000000, type: 'auto', btnClass: 'pink' },
  { id: 'dimension_gym', get name() { return t('shop_dimension_gym_name'); }, icon: '💠', get desc() { return t('shop_dimension_gym_desc') + ' ' + GP_ICON + '/sec.'; }, baseCost: 200000000000000000, type: 'auto', btnClass: 'pink' },
  { id: 'omega_gym', get name() { return t('shop_omega_gym_name'); }, icon: '♾️', get desc() { return t('shop_omega_gym_desc') + ' ' + GP_ICON + '/sec.'; }, baseCost: 15000000000000000000, type: 'auto', btnClass: 'pink' },

  { id: 'creatine', get name() { return t('shop_creatine_name'); }, icon: '💊', get desc() { return t('shop_creatine_desc'); }, baseCost: 500000, type: 'special', btnClass: 'green', maxLevel: 5 },
  { id: 'pelican', get name() { return t('shop_pelican_name'); }, icon: '🐦', get desc() { return t('shop_pelican_desc'); }, baseCost: 2000000, type: 'special', btnClass: 'pink', maxLevel: 5 },
  { id: 'genetics', get name() { return t('shop_genetics_name'); }, icon: '🧬', get desc() { return t('shop_genetics_desc'); }, baseCost: 100000000, type: 'special', btnClass: 'green', maxLevel: 5 },
  { id: 'golden_hands', get name() { return t('shop_golden_hands_name'); }, icon: '🤲', get desc() { return t('shop_golden_hands_desc'); }, baseCost: 5000000000, type: 'special', btnClass: 'pink', maxLevel: 5 },
  { id: 'smartwatch', get name() { return t('shop_smartwatch_name'); }, icon: '⌚', get desc() { return t('shop_smartwatch_desc'); }, baseCost: 50000000000, type: 'special', btnClass: 'green', maxLevel: 3 },
  { id: 'sponsor_sneakers', get name() { return t('shop_sponsor_sneakers_name'); }, icon: '👟', get desc() { return t('shop_sponsor_sneakers_desc'); }, baseCost: 500000000000, type: 'special', btnClass: 'pink', maxLevel: 5 },
  { id: 'steroids', get name() { return t('shop_steroids_name'); }, icon: '💉', get desc() { return t('shop_steroids_desc'); }, baseCost: 500000, type: 'special', btnClass: 'green', isSkill: true },
  { id: 'energy_drink', get name() { return t('shop_energy_drink_name'); }, icon: '🔋', get desc() { return t('shop_energy_drink_desc'); }, baseCost: 1000000000000, type: 'special', btnClass: 'green', isSkill: true }
];


function getLocationMultiplier() {
  const loc = LOCATIONS.find(l => l.id === (state.currentLocation || 'bedroom'));
  return loc ? loc.multiplier : 1;
}

/* ═══════════════════════════════════════════════════════
   GAME STATE
   ═══════════════════════════════════════════════════════ */
let state = {
  version: 2,
  upgrades: {},
  gpCount: 0,
  clickPower: 1,
  autoPower: 0,
  capyMassLevel: 1,
  // costs scale ×1.15 to ×1.5 per level
  steroidsUnlocked: false,
  steroidsActiveUntil: 0,
  steroidsCooldownUntil: 0,
  steroidsLastUsed: 0,
  energyDrinkLastUsed: 0,
  prestigeCoins: 0,
  totalPrestigeCoinsClaimed: 0,
  lastSaveTime: Date.now(),
  soundEnabled: true,
  musicVolume: 50,
  sfxVolume: 50,
  lowPowerMode: false,
  noAds: false,
  totalClicks: 0,
  totalGPEarned: 0,
  runGPEarned: 0,
  totalPrestiges: 0,
  goldenDumbbellsClicked: 0,
  playStartTime: Date.now(),
  unlockedAchievements: [],
  // combo system
  comboClicks: 0,
  comboResetTime: 0,
  comboMultiplier: 1,
  comboActiveUntil: 0,
  lastLoginDate: null,
  loginStreak: 0,
  dailyRewardClaimed: false,
  // events
  activeEvent: null,
  activeEventName: null,
  activeEventMult: 1,
  activeEventUntil: 0,
  // prestige tree
  prestigeUpgrades: {},
  tutorialStep: 0,
  // Phase 10: Gems, Quests, Skins
  gems: 0,
  activeQuests: [],
  questsCompleted: 0,
  skins: [],
  activeSkin: null,
  retroGemsGiven: false,
  currentLocation: 'bedroom',
  tournamentLevel: 1,
  tournamentCooldownUntil: 0,
  lootboxAdsWatched: 0,
  lootboxBuffUntil: 0,
  lootboxBuffMultiplier: 1,
  x2BoostUntil: 0,
  autoClickActiveUntil: 0,
  autoClickCooldownUntil: 0,
  // animation
  squeezeT: 0,
  liftAngle: 0,
  autoAnimPhase: 0,
  // battle pass
  bpLevel: 1,
  bpStars: 0,
  bpClicks: 0,
  hasPremiumBP: false,
  bpClaimedFree: [],
  bpClaimedPremium: [],
  bpClickBuff: 0,
  bpAutoBuff: 0,
  bpCritBuff: 0,
  // gem shop boosts
  gemShopActiveUntil: {},
  gemShopCooldownUntil: {},
};

function saveGame() {
  state.lastSaveTime = Date.now();
  const dataString = JSON.stringify(state);
  localStorage.setItem('capybaraSave', dataString);

  if (player) {
    // Convert state to a flat object format if needed, but Yandex allows nested objects if stringified or just object
    player.setData(state).then(() => {
      // Saved to cloud
    }).catch(() => { });
  }

  // Submit score to leaderboard
  if (leaderboards && state.totalGPEarned) {
    leaderboards.setLeaderboardScore('topCapybara', Math.floor(state.totalGPEarned)).catch(() => { });
  }
}

function processSaveData(parsed) {
  try {
    if (!parsed.version || parsed.version < 2) {
      parsed.version = 2;
      parsed.upgrades = parsed.upgrades || {};
      const oldKeys = ['click', 'titanium', 'alien', 'neutron', 'auto', 'shake', 'bro', 'trainer', 'sponsor', 'chain', 'creatine', 'pelican', 'steroids'];
      oldKeys.forEach(k => {
        if (parsed[k + 'Level'] !== undefined) {
          parsed.upgrades[k] = parsed[k + 'Level'];
          delete parsed[k + 'Level'];
          delete parsed[k + 'Cost'];
        }
      });
    }

    state = { ...state, ...parsed };

    // Daily Login Logic
    const nowRaw = new Date();
    const localDate = nowRaw.getFullYear() + '-' + String(nowRaw.getMonth() + 1).padStart(2, '0') + '-' + String(nowRaw.getDate()).padStart(2, '0');

    if (state.lastLoginDate !== localDate) {
      if (state.lastLoginDate) {
        const lastRaw = new Date(state.lastLoginDate);
        const diffTime = Math.abs(nowRaw - lastRaw);
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays > 1) {
          state.loginStreak = 0; // reset streak if missed a day
        }
      }
      state.dailyRewardClaimed = false;
      state.lootboxAdsWatched = 0; // Сброс бесплатных лутбоксов ежедневно
      state.lastLoginDate = localDate;
    }

    // Offline earnings calculation
    const now = Date.now();
    if (!state.lastSaveTime) state.lastSaveTime = now;
    const secondsOfflineRaw = Math.floor((now - state.lastSaveTime) / 1000);
    const secondsOffline = Math.min(secondsOfflineRaw, 14400); // Max 4 hours (14400 seconds)
    if (secondsOffline > 10 && getEffectiveAutoPower() > 0) {
      let mult = 0.2;
      if (state.prestigeUpgrades && state.prestigeUpgrades['offline_god']) mult = 1.0;
      const earned = Math.floor(secondsOffline * getEffectiveAutoPower() * mult);
      state.gpCount += earned;

      const $modal = document.getElementById('offline-modal');
      if ($modal) {
        let timeMsg = "";
        if (secondsOfflineRaw >= 14400) {
          timeMsg = t('offline_max_time');
        } else {
          const h = Math.floor(secondsOffline / 3600);
          const m = Math.floor((secondsOffline % 3600) / 60);
          const s = secondsOffline % 60;
          let timeParts = [];
          if (h > 0) timeParts.push(`${h} ${t('offline_h')}`);
          if (m > 0) timeParts.push(`${m} ${t('offline_m')}`);
          if (h === 0 && m === 0) timeParts.push(`${s} ${t('offline_s')}`);
          timeMsg = t('offline_time_msg').replace('{time}', timeParts.join(' '));
        }

        $modal.innerHTML = `${t('offline_welcome')}<br><br><span style="font-size:0.9em; opacity:0.9">${timeMsg}</span><br><br><b style="color:var(--gold, #ffbc00); font-size:1.3em;">+${formatNum(earned)} <img src="images/GP.webp" style="height: 1em; vertical-align: middle; transform: translateY(-0.15em);"></b>`;
        $modal.innerHTML += `<br><br><button id="offline-ad-btn" style="width:100%; padding:10px; background:var(--neon-pink); color:#000; border:none; border-radius:8px; cursor:pointer; font-weight:bold;">${t('offline_double_btn')}</button>`;
        $modal.innerHTML += `<br><button id="close-offline" style="width:100%; padding:10px; margin-top:10px; background:var(--border); color:var(--text); border:none; border-radius:8px; cursor:pointer; font-weight:bold;">${t('btn_close')}</button>`;

        $modal.classList.add('show');

        const closeBtn = document.getElementById('close-offline');
        if (closeBtn) closeBtn.onclick = () => $modal.classList.remove('show');

        const adBtn = document.getElementById('offline-ad-btn');
        if (adBtn) {
          adBtn.onclick = () => {
            confirmAd(t('offline_ad_desc'), () => {
              if (ysdk && ysdk.adv) {
                let rewarded = false;
                ysdk.adv.showRewardedVideo({
                  callbacks: {
                    onOpen: () => { onAdOpen(); },
                    onRewarded: () => { rewarded = true; },
                    onClose: () => {
                      onAdClose();
                      if (rewarded) {
                        state.gpCount += earned; // add again (double)
                        saveGame();
                        translateUI();
                        updateUI();
                        showToast(t('toast_offline_doubled'));
                        spawnConfetti();
                        beep(600, 0.1); setTimeout(() => beep(800, 0.2), 100);
                      }
                      $modal.classList.remove('show');
                    },
                    onError: (e) => { onAdClose(); console.error(e); showToast(t('toast_ad_error')); $modal.classList.remove('show'); }
                  }
                });
              } else {
                showToast(t('toast_ad_unavailable'));
              }
            });
          };
        }
      }
    }

    // Retroactive Gems for already completed achievements
    if (!state.retroGemsGiven) {
      if (state.unlockedAchievements && state.unlockedAchievements.length > 0) {
        state.gems = (state.gems || 0) + state.unlockedAchievements.length;
      }
      state.retroGemsGiven = true;
    }

    // Old quests used to store static desc. We don't use it anymore.
    if (typeof ensureQuests === 'function') ensureQuests();

    // Fix totalGPEarned if corrupted
    if (isNaN(state.totalGPEarned) || state.totalGPEarned == null) {
      state.totalGPEarned = 0;
    }
    if (state.runGPEarned == null) {
      state.runGPEarned = state.totalGPEarned;
    }

    state.lastSaveTime = Date.now();
    if (typeof checkDailyAutoOpen === 'function') checkDailyAutoOpen();
  } catch (e) {
    console.error('Save file corrupted', e);
  }
}

function loadGame() {
  if (player) {
    player.getData().then(data => {
      if (Object.keys(data).length > 0) {
        processSaveData(data);
      } else {
        loadFromLocal();
      }
      if (typeof updateUI === 'function') updateUI();
    }).catch(() => {
      loadFromLocal();
      if (typeof updateUI === 'function') updateUI();
    });
  } else {
    loadFromLocal();
    if (typeof updateUI === 'function') updateUI();
  }
}

function loadFromLocal() {
  const saved = localStorage.getItem('capybaraSave');
  if (saved) {
    try {
      processSaveData(JSON.parse(saved));
    } catch (e) {
      console.error("Failed to parse local save", e);
      localStorage.removeItem('capybaraSave'); // Clear corrupted save
    }
  }
  if (typeof ensureQuests === 'function') ensureQuests();
}



/* ═══════════════════════════════════════════════════════
   NUMBER FORMATTING
   ═══════════════════════════════════════════════════════ */
const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];
function formatNum(n) {
  if (n < 0) return '-' + formatNum(-n);
  if (n < 1000) return Math.floor(n).toString();
  let tier = Math.floor(Math.log10(n) / 3);
  if (tier >= SUFFIXES.length) tier = SUFFIXES.length - 1;
  const scaled = n / Math.pow(10, tier * 3);
  return (scaled >= 100 ? Math.floor(scaled) : scaled.toFixed(1)) + SUFFIXES[tier];
}


/* ─── Shop Filters ──────────────────────────────────── */
function filterShop(category) {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.toggle('active', b.dataset.filter === category));
  
  const $shopList = document.getElementById('shop-list');
  const $donateList = document.getElementById('donate-list');
  
  if (category === 'donat') {
    if ($shopList) $shopList.style.display = 'none';
    if ($donateList) {
      $donateList.style.display = 'contents';
      if (typeof renderDonateShop === 'function') renderDonateShop();
    }
    return;
  } else {
    if ($shopList) $shopList.style.display = 'contents';
    if ($donateList) $donateList.style.display = 'none';
  }

  document.querySelectorAll('.shop-card').forEach(card => {
    if (card.id === 'card-prestige') return;
    if (card.parentElement && card.parentElement.id === 'donate-list') return;
    if (card.closest && card.closest('#gem-shop-modal')) return;

    let isMatch = false;
    if (category === 'all') isMatch = true;
    else if (card.dataset.type === category) isMatch = true;

    card.classList.toggle('hidden-by-filter', !isMatch);
  });
}

document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => filterShop(btn.dataset.filter));
});

/* ─── Tier definitions ──────────────────────────────── */
const ACHIEVEMENTS = [
  { id: 'first_blood', get name() { return t('ach_first_blood_name'); }, get desc() { return t('ach_first_blood_desc'); }, icon: '💪', check: s => s.totalClicks >= 1 },
  { id: 'maniac', get name() { return t('ach_maniac_name'); }, get desc() { return t('ach_maniac_desc'); }, icon: '⚡', check: s => s.totalClicks >= 1000 },
  { id: 'passive', get name() { return t('ach_passive_name'); }, get desc() { return t('ach_passive_desc'); }, icon: '📈', check: s => s.autoPower >= 1000 },
  { id: 'golden_touch', get name() { return t('ach_golden_touch_name'); }, get desc() { return t('ach_golden_touch_desc'); }, icon: '✨', check: s => s.goldenDumbbellsClicked >= 5 },
  { id: 'gigachad', get name() { return t('ach_gigachad_name'); }, get desc() { return t('ach_gigachad_desc'); }, icon: '🗿', check: s => s.capyMassLevel >= 4 },
  { id: 'olympus', get name() { return t('ach_olympus_name'); }, get desc() { return t('ach_olympus_desc'); }, icon: '👼', check: s => s.capyMassLevel >= 5 },
  { id: 'prestige', get name() { return t('ach_prestige_name'); }, get desc() { return t('ach_prestige_desc'); }, icon: '🌟', check: s => s.prestigeCoins >= 1 },
];

function checkAchievements() {
  let newUnlocked = false;
  ACHIEVEMENTS.forEach(ach => {
    if (!state.unlockedAchievements.includes(ach.id)) {
      if (ach.check(state)) {
        state.unlockedAchievements.push(ach.id);
        state.gems = (state.gems || 0) + 1; // +1 Gem
        showToast(t('toast_ach_unlocked').replace('{name}', ach.name));
        spawnConfetti();
        beep(500, 0.1); setTimeout(() => beep(700, 0.3), 150);
        newUnlocked = true;
      }
    }
  });
  if (newUnlocked) {
    saveGame();
    renderAchievements();
    translateUI();
    updateUI();
  }
}

function showToast(text) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = text;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 5000);
}

function confirmAd(desc, onConfirm) {
  const $overlay = document.getElementById('ad-confirm-overlay');
  if (!$overlay) { if (onConfirm) onConfirm(); return; }
  document.getElementById('ad-confirm-desc').innerHTML = desc;
  const $yes = document.getElementById('ad-confirm-yes');
  const $no = document.getElementById('ad-confirm-no');
  $overlay.style.display = 'flex';
  $yes.onclick = () => { $overlay.style.display = 'none'; if (onConfirm) onConfirm(); };
  $no.onclick = () => { $overlay.style.display = 'none'; };
}

function renderStats() {
  const $list = document.getElementById('stats-list');
  const timePlayed = Math.floor((Date.now() - state.playStartTime) / 1000);
  const m = Math.floor(timePlayed / 60);
  const s = timePlayed % 60;

  $list.innerHTML = `
        <div style="margin-bottom:12px; font-size:1.1rem; color:var(--neon-blue);">
          ${t('stat_time')}: <b>${m}${t('stat_m')} ${s}${t('stat_s')}</b>
        </div>
        <div style="margin-bottom:12px; font-size:1.1rem; color:var(--gold);">
          ${t('stat_earned')} <img src="images/GP.webp" style="height: 1em; vertical-align: middle; transform: translateY(-0.15em);"> : <b>${formatNum(state.totalGPEarned || 0)}</b>
        </div>
        <div style="margin-bottom:12px; font-size:1.1rem;">
          ${t('stat_clicks')}: <b>${formatNum(state.totalClicks || 0)}</b>
        </div>
        <div style="margin-bottom:12px; font-size:1.1rem; color:#ffbc00;">
          ${t('stat_dumbbells')}: <b>${state.goldenDumbbellsClicked || 0}</b>
        </div>
        <div style="margin-bottom:12px; font-size:1.1rem; color:var(--neon-pink);">
          ${t('stat_prestiges')}: <b>${state.totalPrestiges || 0}</b>
        </div>
        <div style="margin-bottom:12px; font-size:1.1rem;">
          ${t('stat_tier_label')}: <b>${state.capyMassLevel}</b>
        </div>
      `;
}

function renderAchievements() {
  const list = document.getElementById('achievements-list');
  if (!list) return;
  list.innerHTML = '';
  ACHIEVEMENTS.forEach(ach => {
    const isUnlocked = state.unlockedAchievements.includes(ach.id);
    list.innerHTML += `
      <div class="ach-item ${isUnlocked ? 'unlocked' : ''}">
        <div class="ach-icon">${isUnlocked ? ach.icon : '❓'}</div>
        <div class="ach-info">
          <h4>${isUnlocked ? ach.name : '???'}</h4>
          <p>${isUnlocked ? ach.desc : t('ach_locked')}</p>
        </div>
      </div>
    `;
  });
}

/* ─── Tier definitions ──────────────────────────────── */
const TIERS = [
  { level: 1, get name() { return t('tier_1_name'); }, gpNeeded: 0, color: '#cccccc' },
  { level: 2, get name() { return t('tier_2_name'); }, gpNeeded: 10000, color: '#81c784' },
  { level: 3, get name() { return t('tier_3_name'); }, gpNeeded: 500000, color: '#64b5f6' },
  { level: 4, get name() { return t('tier_4_name'); }, gpNeeded: 50000000, color: '#ce93d8' },
  { level: 5, get name() { return t('tier_5_name'); }, gpNeeded: 10000000000, color: '#ffb74d' },
  { level: 6, get name() { return t('tier_6_name'); }, gpNeeded: 5000000000000, color: '#f06292' },
  { level: 7, get name() { return t('tier_7_name'); }, gpNeeded: 3000000000000000, color: '#e57373' },
  { level: 8, get name() { return t('tier_8_name'); }, gpNeeded: 2000000000000000000, color: '#4dd0e1' },
  { level: 9, get name() { return t('tier_9_name'); }, gpNeeded: 2000000000000000000000, color: '#ffffff' }
];

/* ═══════════════════════════════════════════════════════
   AUDIO — Web Audio API (no MediaSession / system player)
   ═══════════════════════════════════════════════════════ */

// ── Shared AudioContext ──
let audioCtx = null;
function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

// ── Background Music (Web Audio API — no system player) ──
let musicBuffer = null;
let musicSource = null;
let musicGainNode = null;
let musicStartOffset = 0;
let musicStartTime = 0;
let musicIsPlaying = false;
window._bgMusicWasPlaying = false;
window._bgMusicShouldPlay = false;

let musicArrayBuffer = null;

// Pre-load music buffer network request, but DO NOT create AudioContext yet!
(async function preloadBgMusic() {
  try {
    const resp = await fetch('sounds/music/DRIVE(chosic.com).mp3');
    musicArrayBuffer = await resp.arrayBuffer();
    // If user already clicked and AudioContext exists, decode it now
    if (audioCtx) {
      musicBuffer = await audioCtx.decodeAudioData(musicArrayBuffer);
      if (window._bgMusicShouldPlay) {
        playBgMusic();
      }
    }
  } catch (e) { console.warn('Music preload failed:', e); }
})();

function playBgMusic() {
  window._bgMusicShouldPlay = true;
  if (musicIsPlaying || !musicBuffer) return;
  try {
    const ctx = getAudioCtx();
    if (ctx.state === 'suspended') ctx.resume();
    if (!musicGainNode) {
      musicGainNode = ctx.createGain();
      musicGainNode.connect(ctx.destination);
    }
    musicSource = ctx.createBufferSource();
    musicSource.buffer = musicBuffer;
    musicSource.loop = true;
    musicSource.connect(musicGainNode);
    musicSource.start(0, musicStartOffset % (musicBuffer.duration || 1));
    musicStartTime = ctx.currentTime;
    musicIsPlaying = true;
  } catch (_) {}
}

function pauseBgMusic() {
  window._bgMusicShouldPlay = false;
  if (!musicIsPlaying || !musicSource) return;
  try {
    const ctx = getAudioCtx();
    musicStartOffset += ctx.currentTime - musicStartTime;
    musicSource.stop();
  } catch (_) {}
  musicSource = null;
  musicIsPlaying = false;
}

function setBgMusicVolume(vol) {
  if (musicGainNode) musicGainNode.gain.value = vol;
}

// Init on first user interaction
async function initBgMusic() {
  const ctx = getAudioCtx(); // Created strictly during user gesture
  if (ctx.state === 'suspended') ctx.resume();
  
  // Play silent buffer to force unlock AudioContext on iOS Safari
  try {
    const buffer = ctx.createBuffer(1, 1, 22050);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
  } catch(e) {}

  // If music was fetched but not yet decoded, decode it now
  if (musicArrayBuffer && !musicBuffer) {
    try {
      musicBuffer = await ctx.decodeAudioData(musicArrayBuffer);
    } catch(e) { console.warn('Decode failed:', e); }
  }

  const vol = (state.musicVolume !== undefined ? state.musicVolume : 50);
  setBgMusicVolume((vol / 100) * 0.3);
  if (vol > 0) playBgMusic();
  
  ['touchstart', 'touchend', 'click'].forEach(e => {
    document.body.removeEventListener(e, initBgMusic);
  });
}
['touchstart', 'touchend', 'click'].forEach(e => {
  document.body.addEventListener(e, initBgMusic, { once: true });
});

// Prevent system media player / notifications (п. 1.6.2.5 / 1.6.1.6)
if ('mediaSession' in navigator) {
  navigator.mediaSession.metadata = null;
  try {
    navigator.mediaSession.setActionHandler('play', null);
    navigator.mediaSession.setActionHandler('pause', null);
    navigator.mediaSession.setActionHandler('seekbackward', null);
    navigator.mediaSession.setActionHandler('seekforward', null);
    navigator.mediaSession.setActionHandler('previoustrack', null);
    navigator.mediaSession.setActionHandler('nexttrack', null);
  } catch (_) {}
}

// ── Beep (oscillator) ──
function beep(freq = 220, dur = 0.06) {
  if (!state.soundEnabled || window.isAdPlaying) return;
  const sfxVol = (state.sfxVolume !== undefined ? state.sfxVolume : 50) / 50;
  if (sfxVol <= 0) return;
  try {
    const ctx = getAudioCtx();
    if (ctx.state === 'suspended') ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.18 * sfxVol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + dur);
  } catch (_) { }
}
function purchaseBeep() { beep(440, 0.08); setTimeout(() => beep(660, 0.08), 80); }

// ── SFX via Web Audio API (no new Audio() — prevents MediaSession) ──
const sfxBufferCache = {};
function playSoundEffect(src) {
  if (!state.soundEnabled || window.isAdPlaying) return;
  const sfxVol = (state.sfxVolume !== undefined ? state.sfxVolume : 50) / 50;
  if (sfxVol <= 0) return;
  const ctx = getAudioCtx();
  if (ctx.state === 'suspended') ctx.resume();

  function playBuffer(buffer) {
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    source.buffer = buffer;
    gain.gain.value = sfxVol;
    source.connect(gain).connect(ctx.destination);
    source.start();
  }

  if (sfxBufferCache[src]) {
    playBuffer(sfxBufferCache[src]);
  } else {
    fetch(src)
      .then(r => r.arrayBuffer())
      .then(buf => ctx.decodeAudioData(buf))
      .then(decoded => { sfxBufferCache[src] = decoded; playBuffer(decoded); })
      .catch(e => console.warn('SFX load failed:', src, e));
  }
}

/* ═══════════════════════════════════════════════════════
   DOM REFS
   ═══════════════════════════════════════════════════════ */
const $gpCount = document.getElementById('gp-count');

const $statClick = document.getElementById('stat-click');
const $statAuto = document.getElementById('stat-auto');
const $statTier = document.getElementById('stat-tier');
const $tierBanner = document.getElementById('tier-banner');
const $stage = document.getElementById('stage');
const canvas = document.getElementById('gym-canvas');
const ctx = canvas.getContext('2d');

/* ═══════════════════════════════════════════════════════
   CORE MECHANICS
   ═══════════════════════════════════════════════════════ */
function getPrestigeMultiplier() {
  let mult = 1 + state.prestigeCoins * 0.2 + (state.unlockedAchievements.length * 0.01);
  // Prestige tree bonuses
  if (state.prestigeUpgrades && state.prestigeUpgrades['golden_muscles']) mult *= 1.25;
  return mult;
}
function getLevel(id) {
  return state.upgrades[id] || 0;
}

function getUpgradeCost(id) {
  const up = SHOP_UPGRADES.find(u => u.id === id);
  if (!up) return 0;
  let scaleFactor;
  if (up.type === 'special') scaleFactor = 2.5;
  else scaleFactor = 1.35;
  return Math.ceil(up.baseCost * Math.pow(scaleFactor, getLevel(id)));
}

function getEffectiveClickPower() {
  let p = 1;
  p += getLevel('click') * 1;
  p += getLevel('titanium') * 3;
  p += getLevel('alien') * 12;
  p += getLevel('neutron') * 55;
  p += getLevel('alien2') * 250;
  p += getLevel('god') * 1200;
  p += getLevel('titan') * 6000;
  p += getLevel('demigod') * 30000;
  p += getLevel('universe_creator') * 150000;
  p += getLevel('reality_bender') * 800000;
  p += getLevel('absolute_power') * 4000000;
  if (getLevel('creatine') > 0) {
    p += Math.floor(getEffectiveAutoPower() * 0.1 * getLevel('creatine'));
  }
  // BP Click Boost
  if (state.bpClickBuff) {
    p = Math.floor(p * (1 + state.bpClickBuff));
  }

  // Events
  const now = Date.now();
  if (state.activeEvent === 'click_frenzy' && now < state.activeEventUntil) p *= 3;
  if (state.activeEvent === 'mega_frenzy' && now < state.activeEventUntil) p *= 5;

  // Gem shop: Berserk Mode (x5 click)
  if (state.gemShopActiveUntil && Date.now() < (state.gemShopActiveUntil.berserk || 0)) {
    p *= 5;
  }

  // Prestige tree: Faster Fingers
  if (state.prestigeUpgrades && state.prestigeUpgrades['faster_fingers']) p *= 2;
  return p * getPrestigeMultiplier();
}

function getEffectiveAutoPower() {
  let p = 0;
  p += getLevel('auto') * 1;
  p += getLevel('shake') * 3;
  p += getLevel('bro') * 8;
  p += getLevel('trainer') * 30;
  p += getLevel('sponsor') * 100;
  p += getLevel('chain') * 400;
  p += getLevel('corp') * 1800;
  p += getLevel('monopoly') * 8000;
  p += getLevel('planet_gym') * 35000;
  p += getLevel('galaxy_gym') * 150000;
  p += getLevel('multiverse_gym') * 650000;
  p += getLevel('dimension_gym') * 2800000;
  p += getLevel('omega_gym') * 12000000;
  if (getLevel('genetics') > 0) {
    p = Math.floor(p * (1 + 0.25 * getLevel('genetics')));
  }
  // Prestige tree: Auto Master
  if (state.prestigeUpgrades && state.prestigeUpgrades['auto_master']) p *= 2;
  // BP Auto Boost
  if (state.bpAutoBuff) {
    p = Math.floor(p * (1 + state.bpAutoBuff));
  }
  // Gem shop: Golden Hour (x3 auto)
  if (state.gemShopActiveUntil && Date.now() < (state.gemShopActiveUntil.golden_hour || 0)) {
    p *= 3;
  }
  return p;
}
function getEffectiveMultiplier() {
  let steroidMult = (state.prestigeUpgrades && state.prestigeUpgrades['steroid_addict']) ? 20 : 10;
  let steroidsActive = Date.now() < state.steroidsActiveUntil || (state.activeEvent === 'steroids' && Date.now() < state.activeEventUntil);
  let mult = steroidsActive ? steroidMult : 1;
  mult *= getLocationMultiplier();
  if (Date.now() < (state.lootboxBuffUntil || 0)) {
    mult *= state.lootboxBuffMultiplier;
  }
  if (state.activeEvent === 'bp_buff' && Date.now() < (state.activeEventUntil || 0)) {
    mult *= (state.activeEventMult || 2); // Temporary multiplier from BP reward
  }
  if (Date.now() < (state.x2BoostUntil || 0)) {
    mult *= 2;
  }
  // Gem shop: Protein Cocktail (x2 all)
  if (state.gemShopActiveUntil && Date.now() < (state.gemShopActiveUntil.protein || 0)) {
    mult *= 2;
  }
  return mult;
}

function updateCombo() {
  const now = Date.now();
  if (now > (state.comboResetTime || 0)) {
    state.comboClicks = 0;
    state.comboMultiplier = 1;
    const $d = document.getElementById('combo-display');
    if ($d) $d.classList.remove('active');
    const $f = document.getElementById('combo-bar-fill');
    if ($f) $f.style.width = '0%';
  }

  state.comboClicks = (state.comboClicks || 0) + 1;
  state.comboResetTime = now + 1500; // 1.5s

  let maxCombo = (state.prestigeUpgrades && state.prestigeUpgrades['combo_king']) ? 2.5 : 1.5;
  // Gem shop: Mega Combo (+1 max, 2x faster accumulation)
  const megaComboActive = state.gemShopActiveUntil && Date.now() < (state.gemShopActiveUntil.mega_combo || 0);
  if (megaComboActive) maxCombo += 1;
  const comboThreshLow = megaComboActive ? 25 : 50;
  const comboThreshHigh = megaComboActive ? 50 : 100;

  if (state.comboClicks > comboThreshHigh) state.comboMultiplier = maxCombo;
  else if (state.comboClicks > comboThreshLow) state.comboMultiplier = Math.min(maxCombo, 1.5);
  else state.comboMultiplier = 1;

  state.comboActiveUntil = state.comboResetTime;

  const $display = document.getElementById('combo-display');
  const $bar = document.getElementById('combo-bar-fill');
  if ($display && state.comboClicks > 10) {
    const comboPrefix = typeof t === 'function' ? t('combo_prefix') : 'COMBO';
    const text = `${comboPrefix} x${state.comboMultiplier}`;
    if ($display.textContent !== text) $display.textContent = text;
    if ($display.className !== 'active') $display.className = 'active';
    if (state.comboMultiplier >= 2.5) {
      if (!$display.classList.contains('x10')) $display.classList.add('x10');
    } else if (state.comboMultiplier >= 1.5) {
      if (!$display.classList.contains('x5')) $display.classList.add('x5');
    }

    let progress = 0;
    if (state.comboClicks <= 50) progress = state.comboClicks / 50;
    else if (state.comboClicks <= 100) progress = (state.comboClicks - 50) / 50;
    else progress = 1;
    if ($bar) {
      const w = `${progress * 100}%`;
      if ($bar.style.width !== w) $bar.style.width = w;
    }
  }
}

let clickTimestamps = [];

function doRep(e) {
  const now = Date.now();
  while (clickTimestamps.length > 0 && now - clickTimestamps[0] >= 1000) {
    clickTimestamps.shift();
  }

  // Убрали назойливое уведомление о кликах
  if (clickTimestamps.length >= 30) {
    return; // Античит: игнорируем клики, если их больше 30 в секунду
  }
  clickTimestamps.push(now);

  // Виброотклик (легкая вибрация для кликера)
  if (navigator.vibrate) {
    navigator.vibrate(15);
  }

  // Боевой Пропуск: +1 Звезда за каждые 500 кликов
  state.bpClicks = (state.bpClicks || 0) + 1;
  if (state.bpClicks >= 500) {
    state.bpClicks = 0;
    addBpStars(1);
  }

  let amt = getEffectiveClickPower();
  let isCrit = false;
  let critChance = (getLevel("pelican") * 0.05) + (state.bpCritBuff || 0);
  // Gem shop: Luck boost (+30% crit)
  if (state.gemShopActiveUntil && Date.now() < (state.gemShopActiveUntil.luck || 0)) {
    critChance += 0.30;
  }
  if (state.prestigeUpgrades && state.prestigeUpgrades['crit_master']) critChance *= 2;
  if ((getLevel("pelican") > 0 || (state.gemShopActiveUntil && Date.now() < (state.gemShopActiveUntil.luck || 0))) && Math.random() < critChance) {
    amt *= 5;
    isCrit = true;
    triggerShake();
  }
  if (getLevel("golden_hands") > 0 && Math.random() < (0.05 * getLevel("golden_hands"))) {
    amt *= 10;
    isCrit = true;
    triggerShake();
  }
  if (getLevel("sponsor_sneakers") > 0 && Math.random() < (0.005 * getLevel("sponsor_sneakers"))) {
    spawnRandomEvent();
  }
  amt *= getEffectiveMultiplier();
  // Combo multiplier
  if (Date.now() < state.comboActiveUntil) {
    amt *= state.comboMultiplier;
  }


  state.totalClicks++;
  state.squeezeT = 1;
  beep(180 + state.capyMassLevel * 40, 0.07);
  spawnFloatGP(amt, isCrit, e);

  if (currentTournament) {
    currentTournament.hpLeft -= amt;
    updateBossUI();
  } else {
    // GP не начисляется во время турнира (согласно описанию)
    state.gpCount += amt;
    state.totalGPEarned = (state.totalGPEarned || 0) + amt;
    state.runGPEarned = (state.runGPEarned || 0) + amt;
  }

  updateCombo();
  fastUpdateUI();
  checkAchievements();
  checkTier();
  if (typeof progressQuest === 'function') progressQuest('click');
}

let activeFloatGP = 0;
function spawnFloatGP(amount, isCrit = false, e = null) {
  if (activeFloatGP >= 20) return;
  activeFloatGP++;

  const el = document.createElement('div');
  el.className = 'float-gp';
  if (isCrit) el.classList.add('crit');
  el.innerHTML = `+${formatNum(amount)} <img src="images/GP.webp" style="height: 1em; vertical-align: middle; transform: translateY(-0.15em);">`;

  const rect = $stage.getBoundingClientRect();
  let cx, cy;
  if (e && e.clientX !== undefined) {
    cx = e.clientX - rect.left - 20;
    cy = e.clientY - rect.top - 20;
  } else {
    cx = rect.width / 2 + (Math.random() - 0.5) * 80;
    cy = rect.height * 0.42;
  }

  el.style.left = cx + 'px';
  el.style.top = cy + 'px';
  $stage.appendChild(el);
  
  let removed = false;
  const doRemove = () => {
    if (!removed) {
      removed = true;
      el.remove();
      activeFloatGP--;
    }
  };
  el.addEventListener('animationend', doRemove);
  setTimeout(doRemove, 3000);
}

let lastShakeTime = 0;
function triggerShake() {
  const now = Date.now();
  if (now - lastShakeTime < 100) return;
  lastShakeTime = now;
  $stage.classList.remove('shake');
  void $stage.offsetWidth; // trigger reflow
  $stage.classList.add('shake');
  setTimeout(() => $stage.classList.remove('shake'), 300);
}

function spawnConfetti() {
  const colors = ['#39ff14', '#ff2eaa', '#00e5ff', '#ffd700'];
  for (let i = 0; i < 40; i++) {
    const conf = document.createElement('div');
    conf.className = 'confetti';
    conf.style.left = Math.random() * 100 + '%';
    conf.style.top = -10 + 'px';
    conf.style.background = colors[Math.floor(Math.random() * colors.length)];
    conf.style.animationDuration = (Math.random() * 2 + 1) + 's';
    $stage.appendChild(conf);
    setTimeout(() => conf.remove(), 3000);
  }
}

function getOrCalcPrestigeCoinsClaimed() {
  if (state.totalPrestigeCoinsClaimed != null) return state.totalPrestigeCoinsClaimed;
  let spent = 0;
  if (state.prestigeUpgrades) {
    const upgCosts = {
      faster_fingers: 3, crit_master: 6, combo_king: 10, steroid_addict: 25,
      auto_master: 3, offline_god: 6, golden_dumbbell_freq: 10, quest_master: 25,
      golden_start: 3, cheap_upgrades: 6, golden_muscles: 10, lootbox_luck: 25
    };
    for (const key in state.prestigeUpgrades) {
      if (state.prestigeUpgrades[key] && upgCosts[key]) spent += upgCosts[key];
    }
  }
  state.totalPrestigeCoinsClaimed = (state.prestigeCoins || 0) + spent;
  return state.totalPrestigeCoinsClaimed;
}

function getDiscountedCost(cost) {
  return (state.prestigeUpgrades && state.prestigeUpgrades['cheap_upgrades']) ? Math.floor(cost * 0.85) : cost;
}

let shopRendered = false;
function renderShop(force = false) {
  const list = document.getElementById('shop-list');
  if (!list) return;

  if (!shopRendered || force) {
    list.innerHTML = '';
    SHOP_UPGRADES.forEach(up => {
      let extra = '';
      if (up.isSkill) {
        extra = `<button class="buy-btn pink" id="use-skill-${up.id}" onclick="useSkill('${up.id}')">${t('btn_use')}</button>`;
      }
      list.innerHTML += `
             <div class="shop-card" data-type="${up.type}">
               <div class="card-meta">
                 <span class="card-title">${up.icon} ${up.name}</span>
                 <span class="card-level" id="shop-level-${up.id}"></span>
               </div>
               <div class="card-desc">${up.desc}</div>
               <div class="card-meta">
                 <span class="card-cost" id="shop-cost-${up.id}"></span>
                 <div style="display:flex; gap: 5px;">
                   <button class="buy-btn ${up.btnClass}" id="shop-btn-${up.id}" onclick="buyUpgrade('${up.id}')">${t('btn_buy') || 'Купить'}</button>
                   ${extra}
                 </div>
               </div>
             </div>
           `;
    });
    shopRendered = true;
    const activeBtn = document.querySelector('.filter-btn.active');
    if (activeBtn) filterShop(activeBtn.dataset.filter);
  }

  SHOP_UPGRADES.forEach(up => {
    const lvl = getLevel(up.id);
    const cost = getDiscountedCost(getUpgradeCost(up.id));
    const canBuy = state.gpCount >= cost;

    const lvlEl = document.getElementById(`shop-level-${up.id}`);
    if (lvlEl) lvlEl.textContent = `${t('shop_level')} ${lvl}`;

    const costEl = document.getElementById(`shop-cost-${up.id}`);
    if (costEl) costEl.innerHTML = `${t('shop_price')} ${formatNum(cost)} <img src="images/GP.webp" style="height: 1em; vertical-align: middle; transform: translateY(-0.15em);">`;

    const btnEl = document.getElementById(`shop-btn-${up.id}`);
    if (btnEl) {
      if (up.maxLevel && lvl >= up.maxLevel) {
        btnEl.disabled = true;
        btnEl.textContent = t('shop_max') || 'МАКС';
        if (costEl) costEl.textContent = t('shop_max_level') || 'МАКС. УРОВЕНЬ';
      } else {
        btnEl.disabled = !canBuy;
        btnEl.textContent = t('btn_buy') || 'Купить';
      }
    }
  });
}

function useSkill(id) {
  if (id === 'steroids') {
    const now = Date.now();
    const lvl = getLevel('steroids');
    if (lvl === 0) return;
    let cd = 60000;
    if (getLevel('smartwatch') > 0) cd *= (1 - 0.1 * getLevel('smartwatch'));
    if (!state.steroidsLastUsed || now - state.steroidsLastUsed > cd) {
      state.steroidsLastUsed = now;
      state.activeEvent = 'steroids';
      state.activeEventUntil = now + getSteroidsDuration();
      showToast(t('toast_steroids_active'));
      beep(880, 0.1);
    } else {
      const left = Math.ceil((cd - (now - state.steroidsLastUsed)) / 1000);
      showToast(t('toast_cooldown').replace('{time}', left));
    }
  } else if (id === 'energy_drink') {
    const now = Date.now();
    const lvl = getLevel('energy_drink');
    if (lvl === 0) return;
    let cd = 90000;
    if (getLevel('smartwatch') > 0) cd *= (1 - 0.1 * getLevel('smartwatch'));
    if (!state.energyDrinkLastUsed || now - state.energyDrinkLastUsed > cd) {
      state.energyDrinkLastUsed = now;
      state.activeEvent = 'energy_drink';
      state.activeEventUntil = now + 15000;
      showToast(t('toast_energy_drink_active'));
      beep(880, 0.1);
    } else {
      const left = Math.ceil((cd - (now - state.energyDrinkLastUsed)) / 1000);
      showToast(t('toast_cooldown').replace('{time}', left));
    }
  }
}

function buyUpgrade(id) {
  const initialGp = state.gpCount;
  const up = SHOP_UPGRADES.find(u => u.id === id);
  if (!up) return;

  if (up.isSkill) {
    if (getLevel(id) === 0 && state.gpCount >= up.baseCost) {
      state.gpCount -= up.baseCost;
      state.upgrades[id] = 1;
      purchaseBeep();
    } else {
      useSkill(id);
    }
  } else {
    if (up.maxLevel && getLevel(id) >= up.maxLevel) return;
    const cost = getDiscountedCost(getUpgradeCost(id));
    if (state.gpCount >= cost) {
      state.gpCount -= cost;
      state.upgrades[id] = getLevel(id) + 1;
      purchaseBeep();
    }
  }

  if (state.gpCount < initialGp) {
    if (typeof progressQuest === 'function') progressQuest('buy');
  }
  checkTier();
  translateUI();
  updateUI();
}
function checkTier() {
  let newTier = 1;
  // Используем runGPEarned если есть, иначе берём текущий gpCount
  const totalEarned = (state.runGPEarned || 0) > 0 ? state.runGPEarned : state.gpCount;
  for (const tierDef of TIERS) {
    if (totalEarned >= tierDef.gpNeeded) newTier = tierDef.level;
  }

  const tier = TIERS[newTier - 1];
  if ($tierBanner) {
    const expectedText = `${t('shop_level').toUpperCase()} ${tier.level} — ${tier.name}`;
    if ($tierBanner.textContent !== expectedText) {
      $tierBanner.textContent = expectedText;
      $tierBanner.style.color = tier.color;
      $tierBanner.style.textShadow = `0 0 10px ${tier.color}80`;
    }
  }

  if (newTier !== state.capyMassLevel) {
    state.capyMassLevel = newTier;
    const newLoc = LOCATIONS.find(l => l.reqTier === newTier);
    if (newLoc) {
      state.currentLocation = newLoc.id;
    }
    resizeCanvas();
    triggerShake();
    spawnConfetti();
    if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 200]);
    beep(440, 0.1); setTimeout(() => beep(554, 0.1), 150); setTimeout(() => beep(659, 0.3), 300);
  }
}

function fastUpdateUI() {
  if (typeof $gpCount !== 'undefined' && $gpCount) {
    const t = formatNum(Math.floor(state.gpCount));
    if ($gpCount.textContent !== t) $gpCount.textContent = t;
  }
  const gemEl = document.getElementById('gem-count');
  if (gemEl) {
    const t = formatNum(state.gems || 0);
    if (gemEl.textContent !== t) gemEl.textContent = t;
  }
  const wardrobeGemsVal = document.getElementById('wardrobe-gems-val');
  if (wardrobeGemsVal) {
    const t = String(state.gems || 0);
    if (wardrobeGemsVal.textContent !== t) wardrobeGemsVal.textContent = t;
  }

  const fill = document.getElementById('tier-progress-fill');
  const text = document.getElementById('tier-progress-text');
  if (fill && text && typeof TIERS !== 'undefined') {
    const totalEarned = (state.runGPEarned || 0) > 0 ? state.runGPEarned : state.gpCount;
    let currentTier = TIERS[0];
    let nextTier = null;
    for (let i = 0; i < TIERS.length; i++) {
      if (totalEarned >= TIERS[i].gpNeeded) {
        currentTier = TIERS[i];
        nextTier = i < TIERS.length - 1 ? TIERS[i + 1] : null;
      }
    }
    if (nextTier) {
      const needed = nextTier.gpNeeded - currentTier.gpNeeded;
      const progress = totalEarned - currentTier.gpNeeded;
      let pct = (progress / needed) * 100;
      if (pct > 100) pct = 100;
      if (pct < 0) pct = 0;
      const w = pct + '%';
      if (fill.style.width !== w) fill.style.width = w;
      const t = `${formatNum(Math.floor(totalEarned))} / ${formatNum(Math.floor(nextTier.gpNeeded))} GP`;
      if (text.textContent !== t) text.textContent = t;
    } else {
      if (fill.style.width !== '100%') fill.style.width = '100%';
      if (text.textContent !== 'MAX LEVEL') text.textContent = 'MAX LEVEL';
    }
  }
}

function updateUI() {
  try {
    const now = Date.now();
    const fever = now < (state.activeEventUntil || 0);
    document.body.classList.toggle('fever', fever);

    const $eventBanner = document.getElementById('event-banner');
    if ($eventBanner) {
      if (fever && state.activeEventName) {
        const left = Math.ceil((state.activeEventUntil - now) / 1000);
        const text = `🔥 ${state.activeEventName} (${left}с)`;
        if ($eventBanner.textContent !== text) $eventBanner.textContent = text;
        $eventBanner.classList.add('visible');
      } else {
        $eventBanner.classList.remove('visible');
      }
    }

    const $lootboxBanner = document.getElementById('lootbox-banner');
    if ($lootboxBanner) {
      if (state.lootboxBuffUntil && state.lootboxBuffUntil > now) {
        const left = Math.ceil((state.lootboxBuffUntil - now) / 1000);
        const mins = Math.floor(left / 60);
        const secs = left % 60;
        $lootboxBanner.textContent = `${t('event_super_buff')} (${mins}:${secs < 10 ? '0' : ''}${secs})`;
        $lootboxBanner.classList.add('visible');
      } else {
        $lootboxBanner.classList.remove('visible');
      }
    }

    if (typeof fastUpdateUI === 'function') fastUpdateUI();

    const $bpBtn = document.getElementById('bp-btn');
    if ($bpBtn) {
      const hasUnclaimedBP = typeof hasUnclaimedBPRewards === 'function' && hasUnclaimedBPRewards();
      $bpBtn.classList.toggle('pulse-gold', !!hasUnclaimedBP);
    }

    const $questsBtn = document.getElementById('quests-btn');
    if ($questsBtn) {
      const hasCompletedQuest = state.activeQuests && state.activeQuests.some(q => q.completed);
      $questsBtn.classList.toggle('pulse', !!hasCompletedQuest);
    }

    const $dailyBtn = document.getElementById('daily-btn');
    if ($dailyBtn) {
      $dailyBtn.classList.toggle('pulse', !state.dailyRewardClaimed);
    }

    const $x2Btn = document.getElementById('x2-boost-btn');
    if ($x2Btn) {
      const $text = $x2Btn.querySelector('.btn-text');
      if (now < (state.x2BoostUntil || 0)) {
        const left = Math.ceil((state.x2BoostUntil - now) / 1000);
        const m = Math.floor(left / 60);
        const s = left % 60;
        if ($text) $text.textContent = `${m}:${s < 10 ? '0' : ''}${s}`;
        $x2Btn.style.background = 'var(--neon-blue)';
        $x2Btn.style.color = 'black';
      } else {
        if ($text) $text.textContent = '';
        $x2Btn.style.background = 'none';
        $x2Btn.style.color = 'var(--neon-blue)';
      }
    }
    
    const $autoBtn = document.getElementById('auto-clicker-btn');
    if ($autoBtn) {
      const $text = $autoBtn.querySelector('.btn-text');
      if (now < (state.autoClickActiveUntil || 0)) {
        const left = Math.ceil((state.autoClickActiveUntil - now) / 1000);
        if ($text) $text.textContent = `${left}с`;
        $autoBtn.style.background = 'var(--neon-green)';
        $autoBtn.style.color = 'black';
      } else if (now < (state.autoClickCooldownUntil || 0)) {
        const left = Math.ceil((state.autoClickCooldownUntil - now) / 1000);
        const m = Math.floor(left / 60);
        const s = left % 60;
        if ($text) $text.textContent = `⏳ ${m}:${s < 10 ? '0' : ''}${s}`;
        $autoBtn.style.background = 'var(--bg-card)';
        $autoBtn.style.color = 'gray';
      } else {
        if ($text) $text.textContent = '';
        $autoBtn.style.background = 'none';
        $autoBtn.style.color = 'var(--neon-green)';
      }
    }

    renderShop();
    if (document.getElementById('gem-shop-overlay')?.style.display === 'flex') {
      renderGemShop();
    }
    const claimedCoins = getOrCalcPrestigeCoinsClaimed();

    const totalCoinsEarned = Math.floor(Math.log(Math.max(1, (state.totalGPEarned || 0) / 1000000)) / Math.log(5));
    const coinsToGet = Math.max(0, totalCoinsEarned - claimedCoins);
    const $cardPrestige = document.getElementById('card-prestige');

    if (state.capyMassLevel >= 5 || state.prestigeCoins > 0 || (state.totalPrestiges || 0) > 0 || coinsToGet > 0) {
      $cardPrestige.style.display = 'block';
      document.getElementById('prestige-reward').textContent = coinsToGet;

      const btnPrestige = document.getElementById('btn-prestige');
      if (coinsToGet === 0) {
        btnPrestige.disabled = true;
        const nextCoinThreshold = claimedCoins + 1;
        const gpNeeded = 1000000 * Math.pow(5, nextCoinThreshold);
        const gpRemaining = gpNeeded - (state.totalGPEarned || 0);
        const tmpl = t('prestige_more_gp');
        btnPrestige.textContent = (tmpl && tmpl !== 'prestige_more_gp') ? tmpl.replace('{0}', formatNum(gpRemaining)) : `ЕЩЕ ${formatNum(gpRemaining)} GP`;
        btnPrestige.style.fontSize = '0.75rem';
      } else {
        btnPrestige.disabled = false;
        btnPrestige.textContent = t('btn_prestige') || 'ПРЕСТИЖ';
        btnPrestige.style.fontSize = '1rem';
      }
    } else {
      $cardPrestige.style.display = 'none';
    }

    const $statCoinsWrap = document.getElementById('stat-coins-wrap');
    if (state.prestigeCoins > 0) {
      $statCoinsWrap.style.display = 'block';
      document.getElementById('stat-coins').textContent = state.prestigeCoins;
    } else {
      $statCoinsWrap.style.display = 'none';
    }

    $statClick.textContent = formatNum(getEffectiveClickPower());
    $statAuto.textContent = formatNum(getEffectiveAutoPower() * getPrestigeMultiplier());
    $statTier.textContent = state.capyMassLevel;

    // Show prestige tree button when coins > 0
    const $ptBtn = document.getElementById('prestige-tree-btn');
    if (state.prestigeCoins > 0 || (state.prestigeUpgrades && Object.keys(state.prestigeUpgrades).length > 0)) {
      $ptBtn.style.display = 'inline-block';
    }

    // Update Tournament Button
    const $tournBtn = document.getElementById('tournament-btn');
    if ($tournBtn) {
      if (state.tournamentCooldownUntil > now) {
        $tournBtn.classList.add('cooldown');
        const mins = Math.floor((state.tournamentCooldownUntil - now) / 60000);
        const secs = Math.floor(((state.tournamentCooldownUntil - now) % 60000) / 1000);
        const timeStr = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
        const newTitle = `${t('tournament_cooldown')} ` + timeStr;
        if ($tournBtn.title !== newTitle) $tournBtn.title = newTitle;

        const $text = $tournBtn.querySelector('.btn-text');
        if ($text) $text.textContent = timeStr;
      } else {
        $tournBtn.classList.remove('cooldown');
        const newTitle = t('tournament_level').replace('{level}', state.tournamentLevel);
        if ($tournBtn.title !== newTitle) $tournBtn.title = newTitle;
        
        const $text = $tournBtn.querySelector('.btn-text');
        if ($text) $text.textContent = '';
      }
    }

    // Обновляем фон при каждом обновлении UI, а не 60 раз в секунду
    const loc = LOCATIONS.find(l => l.id === (state.currentLocation || 'bedroom')) || LOCATIONS[0];
    const $stageVideo = document.getElementById('stage-video');
    if (loc.video && !state.lowPowerMode) {
      $stage.style.backgroundImage = 'none';
      if (!$stageVideo.src.endsWith(encodeURI(loc.video).replace(/#/g, '%23'))) {
          $stageVideo.src = loc.video;
          $stageVideo.play().catch(e => console.warn('Video play prevented', e));
      } else if ($stageVideo.paused) {
          $stageVideo.play().catch(e => console.warn('Video play prevented', e));
      }
      $stageVideo.style.display = 'block';
    } else {
      let staticImg = loc.bgImage;
      if (staticImg === 'none' && loc.video) {
          // Construct static fallback
          const staticFileName = loc.video.replace('Animated/', 'Static/').replace('bg-', '').replace('BG-', '').replace('.mp4', '.webp');
          staticImg = `url("${staticFileName}")`;
      }
      $stage.style.backgroundImage = staticImg;
      $stage.style.backgroundSize = 'cover';
      $stage.style.backgroundPosition = 'center bottom';
      if ($stageVideo && $stageVideo.style.display !== 'none') {
        $stageVideo.style.display = 'none';
        $stageVideo.pause();
        $stageVideo.removeAttribute('src');
        $stageVideo.load();
      }
    }
    // Gem Boost Banners
    const $bannersContainer = document.getElementById('bottom-banners-container');
    if ($bannersContainer) {
      let activeBoosts = [];
      const nowMs = Date.now();
      GEM_SHOP_ITEMS.forEach(item => {
        const activeUntil = state.gemShopActiveUntil?.[item.id] || 0;
        if (nowMs < activeUntil) activeBoosts.push({ item, activeUntil });
      });
      
      Array.from($bannersContainer.children).forEach($child => {
        if ($child.id === 'event-banner' || $child.id === 'lootbox-banner') return;
        if (!activeBoosts.find(b => b.item.id === $child.dataset.id)) {
          $child.remove();
        }
      });

      activeBoosts.forEach(b => {
        const left = Math.ceil((b.activeUntil - nowMs) / 1000);
        const m = Math.floor(left / 60);
        const s = left % 60;
        const timeStr = `${m}:${s < 10 ? '0' : ''}${s}`;
        const text = `${b.item.icon} ${b.item.name}: ${timeStr}`;

        let $banner = $bannersContainer.querySelector(`[data-id="${b.item.id}"]`);
        if (!$banner) {
          $banner = document.createElement('div');
          $banner.dataset.id = b.item.id;
          $banner.className = 'game-banner visible';
          $bannersContainer.appendChild($banner);
        }
        if ($banner.textContent !== text) {
          $banner.textContent = text;
        }
      });
    }

  } catch (e) {
    console.error("UI Error: " + e.stack);
  }
}

function doPrestige() {
  const claimedCoins = getOrCalcPrestigeCoinsClaimed();

  const totalCoinsEarned = Math.floor(Math.log(Math.max(1, (state.totalGPEarned || 0) / 1000000)) / Math.log(5));
  const coinsToGet = Math.max(0, totalCoinsEarned - claimedCoins);
  if (coinsToGet > 0) {
    showCustomConfirm(
      t('confirm_title'),
      t('prestige_confirm_text').replace('{coins}', coinsToGet).replace('{bonus}', coinsToGet * 20),
      () => {

      state.prestigeCoins = (state.prestigeCoins || 0) + coinsToGet;
      state.totalPrestigeCoinsClaimed = (state.totalPrestigeCoinsClaimed || 0) + coinsToGet;
      state.totalPrestiges = (state.totalPrestiges || 0) + 1;

      // Reset state
      state.gpCount = (state.prestigeUpgrades && state.prestigeUpgrades['golden_start']) ? 1000 : 0;
      state.capyMassLevel = 1;
      state.currentLocation = 'bedroom';
      state.upgrades = {};
      state.runGPEarned = state.gpCount;

      saveGame();
      checkTier();
      updateUI();
      checkAchievements();
      spawnConfetti();
      spawnConfetti();
      triggerShake();
      beep(200, 0.2); setTimeout(() => beep(300, 0.2), 200); setTimeout(() => beep(400, 0.4), 400);
    }
    );
  } else {
    const nextCoinThreshold = claimedCoins + 1;
    const gpNeeded = 1000000 * Math.pow(5, nextCoinThreshold);
    const gpRemaining = gpNeeded - (state.totalGPEarned || 0);
    showToast(t('toast_prestige_not_enough').replace('{gp}', formatNum(gpRemaining)));
  }
}

/* ═══════════════════════════════════════════════════════
   CANVAS DRAWING — Capybara + Gym
   ═══════════════════════════════════════════════════════ */
function resizeCanvas() {
  const rect = $stage.getBoundingClientRect();
  if (!rect || rect.width === 0) return;

  // Адаптивный масштаб для каждого тира (настраиваем "безопасную зону")
  // Если капибара будет больше этих значений, она обрежется по краям.
  const tier = (typeof state !== 'undefined' && state.capyMassLevel) ? state.capyMassLevel : 1;
  let capyW = 350, capyH = 450;
  if (tier === 2) { capyW = 450; capyH = 550; }
  else if (tier === 3) { capyW = 550; capyH = 650; } // Качок
  else if (tier === 4) { capyW = 800; capyH = 750; } // Гигачад
  else if (tier >= 5) { capyW = 750; capyH = 750; } // Бог

  let scale = 1;
  if (rect.width > 0 && rect.height > 0) {
    const scaleX = capyW / rect.width;
    const scaleY = capyH / (rect.height * 0.78); // 0.78 это наш floorY

    // Берём максимальный масштаб, чтобы гарантированно влезть и по ширине, и по высоте.
    // Немного уменьшаем его (0.95), чтобы капибара была чуть-чуть крупнее (массивнее), 
    // допуская лёгкое обрезание размаха рук.
    scale = Math.max(1, scaleX, scaleY) * 0.95;
  }

  const logicW = rect.width * scale;
  const logicH = rect.height * scale;

  canvas.width = logicW * devicePixelRatio;
  canvas.height = logicH * devicePixelRatio;

  canvas.style.width = rect.width + 'px';
  canvas.style.height = rect.height + 'px';

  // Оставляем только devicePixelRatio, чтобы не было двойного масштабирования
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function drawFrame(ts) {
  const W = canvas.width / devicePixelRatio;
  const H = canvas.height / devicePixelRatio;
  ctx.clearRect(0, 0, W, H);

  // ── Floor / platform ──
  const floorY = H * 0.78;
  // Отрисовка пола удалена, так как теперь используются картинки фонов.

  // ── Squeeze animation decay & Auto Animation ──
  if (state.squeezeT > 0) state.squeezeT = Math.max(0, state.squeezeT - 0.06);

  if (getEffectiveAutoPower() > 0) {
    const speed = 0.05 + Math.min(0.25, getEffectiveAutoPower() * 0.005);
    state.autoAnimPhase = (state.autoAnimPhase || 0) + speed;
  } else {
    state.autoAnimPhase = 0;
  }

  const autoSqueeze = getEffectiveAutoPower() > 0 ? (Math.sin(state.autoAnimPhase) + 1) / 2 : 0;
  const squeeze = Math.max(state.squeezeT, autoSqueeze * 0.85);

  // ── Capybara dimensions by tier ──
  const tier = state.capyMassLevel;
  let bodyW, bodyH, headR, earR, legW, legH, armW, armLen;
  if (tier === 1) {
    bodyW = 60; bodyH = 80;
    headR = 26; earR = 8;
    legW = 10; legH = 30;
    armW = 8; armLen = 40;
  } else if (tier === 2) {
    bodyW = 90; bodyH = 85;
    headR = 30; earR = 9;
    legW = 14; legH = 30;
    armW = 14; armLen = 48;
  } else if (tier === 3) {
    bodyW = 150; bodyH = 100;
    headR = 34; earR = 10;
    legW = 20; legH = 32;
    armW = 24; armLen = 60;
  } else if (tier === 4) {
    bodyW = 200; bodyH = 120;
    headR = 40; earR = 12;
    legW = 26; legH = 36;
    armW = 34; armLen = 75;
  } else {
    bodyW = 260; bodyH = 140;
    headR = 46; earR = 14;
    legW = 34; legH = 40;
    armW = 46; armLen = 90;
  }

  const cx = W / 2;
  const cy = floorY;
  const squishX = 1 + squeeze * 0.12;
  const squishY = 1 - squeeze * 0.08;

  // Aura for tier 4+
  if (tier === 9) {
    ctx.save();
    const bodyBottom = -legH;
    const bodyTop = bodyBottom - bodyH;
    // Круг (аура) поднимаем выше, чтобы было четко видно, что капибара стоит на ногах
    let centerY = -350;

    const time = Date.now() / 1000;
    // Эффект плавного плавания вокруг капибары
    const offsetX = Math.sin(time) * 15;
    const offsetY = Math.cos(time * 1.3) * 15;

    ctx.translate(cx + offsetX, cy + centerY + offsetY);
    // Медленное вращение ровно вокруг своего центра
    ctx.rotate(time * 0.2);

    const bgImg = CAPY_IMAGES[9].bg;
    let aw = 700, ah = 700;
    if (bgImg.complete && bgImg.naturalWidth) {
      const aspect = bgImg.naturalWidth / bgImg.naturalHeight;
      if (aspect > 1) { aw = 700; ah = 700 / aspect; }
      else { ah = 700; aw = 700 * aspect; }
      ctx.drawImage(bgImg, -aw / 2, -ah / 2, aw, ah);
    }
    ctx.restore();
  }

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(squishX, squishY);

  const imgSet = CAPY_IMAGES[tier] || CAPY_IMAGES[9];
  let skinImg = null;
  if (state.activeSkin && SKIN_IMAGES[state.activeSkin]) {
    skinImg = SKIN_IMAGES[state.activeSkin][tier];
  }

  const bodyBottom = -legH;
  const bodyTop = bodyBottom - bodyH;
  const armY = bodyTop + bodyH * 0.25;
  const headY = bodyTop - headR * 0.65;

  let liftAng = squeeze * 0.5; // Базовая амплитуда качания

  // ── НАСТРОЙКИ ОТРИСОВКИ ДЛЯ КАЖДОГО УРОВНЯ ──
  // Вы можете изменять цифры ниже для подгонки позиций и размеров
  if (skinImg) {
    let fw = 500, fh = 500;
    if (skinImg.complete && skinImg.naturalWidth) {
      const aspect = skinImg.naturalWidth / skinImg.naturalHeight;
      if (tier === 1) fh = bodyH * 3.5;
      else if (tier === 2) fh = bodyH * 4.5;
      else if (tier === 3) fh = bodyH * 4.8;
      else if (tier === 4) fh = bodyH * 5.0;
      else fh = 550;
      fw = fh * aspect;
      ctx.drawImage(skinImg, -fw / 2, -fh + legH + 40, fw, fh);
    }
  } else if (imgSet.hasFull) {
    let fw = 500, fh = 500;
    if (imgSet.full.complete && imgSet.full.naturalWidth) {
      const aspect = imgSet.full.naturalWidth / imgSet.full.naturalHeight;
      if (tier === 1) fh = bodyH * 3.5;
      else if (tier === 2) fh = bodyH * 4.5;
      else if (tier === 3) fh = bodyH * 4.8;
      else if (tier === 4) fh = bodyH * 5.0;
      else fh = 550;
      fw = fh * aspect;
      ctx.drawImage(imgSet.full, -fw / 2, -fh + legH + 40, fw, fh);
    }
  }

  ctx.restore(); // undo squish

  requestAnimationFrame(drawFrame);
}

requestAnimationFrame(drawFrame);

/* ═══════════════════════════════════════════════════════
   EVENT BINDINGS
   ═══════════════════════════════════════════════════════ */
document.getElementById('mute-btn')?.addEventListener('click', (e) => {
  state.soundEnabled = !state.soundEnabled;
  e.target.textContent = state.soundEnabled ? '🔊' : '🔇';
});

// Help Modal
document.getElementById('help-btn')?.addEventListener('click', () => {
  document.getElementById('help-overlay').style.display = 'flex';
});

document.getElementById('gem-shop-btn')?.addEventListener('click', () => {
  renderGemShop();
  document.getElementById('gem-shop-overlay').style.display = 'flex';
});
document.getElementById('close-gem-shop')?.addEventListener('click', () => {
  document.getElementById('gem-shop-overlay').style.display = 'none';
  showInterstitialAd();
});
document.getElementById('close-help')?.addEventListener('click', () => {
  document.getElementById('help-overlay').style.display = 'none';
  showInterstitialAd();
});

// Settings Modal
document.getElementById('settings-btn')?.addEventListener('click', () => {
  document.getElementById('settings-overlay').style.display = 'flex';

  // Set initial slider values
  const musicVol = document.getElementById('music-vol');
  const sfxVol = document.getElementById('sfx-vol');
  if (musicVol) {
    musicVol.value = (state.musicVolume !== undefined ? state.musicVolume : 50);
    document.getElementById('music-vol-label').textContent = musicVol.value + '%';
  }
  if (sfxVol) {
    sfxVol.value = (state.sfxVolume !== undefined ? state.sfxVolume : 50);
    document.getElementById('sfx-vol-label').textContent = sfxVol.value + '%';
  }
  
  const lowPowerCb = document.getElementById('low-power-mode');
  if (lowPowerCb) {
    lowPowerCb.checked = !!state.lowPowerMode;
  }
});

document.getElementById('low-power-mode')?.addEventListener('change', (e) => {
  state.lowPowerMode = e.target.checked;
  saveGame();
  
  // Update the stage video/image immediately
  const loc = LOCATIONS.find(l => l.id === (state.currentLocation || 'bedroom')) || LOCATIONS[0];
  const $stageVideo = document.getElementById('stage-video');
  const $stage = document.getElementById('stage');
  
  if (state.lowPowerMode) {
    if ($stageVideo) {
      $stageVideo.pause();
      $stageVideo.style.display = 'none';
    }
    // Fallback to static if available, else a default or its static equivalent
    if (loc.bgImage !== 'none') {
        $stage.style.backgroundImage = loc.bgImage;
    } else {
        // If it was 'none' but had a video, we need to map it back to static manually
        // We can just construct the static path
        const staticFileName = loc.video.replace('Animated/', 'Static/').replace('bg-', '').replace('BG-', '').replace('.mp4', '.webp');
        $stage.style.backgroundImage = `url("${staticFileName}")`;
    }
    $stage.style.backgroundSize = 'cover';
    $stage.style.backgroundPosition = 'center bottom';
  } else {
    updateUI(); // Will re-enable video if loc.video is set
  }
});

document.getElementById('close-settings')?.addEventListener('click', () => {
  document.getElementById('settings-overlay').style.display = 'none';
  saveGame();
  showInterstitialAd();
});

document.getElementById('auth-btn')?.addEventListener('click', () => {
  if (ysdk && ysdk.auth) {
    ysdk.auth.openAuthDialog().then(() => {
      // Успешная авторизация
      ysdk.getPlayer({ scopes: false }).then(_player => {
        player = _player;
        const authBtn = document.getElementById('auth-btn');
        const authDesc = document.getElementById('auth-desc');
        if (authBtn) authBtn.style.display = 'none';
        if (authDesc) authDesc.style.display = 'none';
        showToast(typeof t === 'function' ? (t('toast_auth_success') || 'Успешная авторизация!') : 'Успешная авторизация!');
        loadGame(); // Загружаем облачный сейв
      }).catch(console.error);
    }).catch(() => {
      showToast(typeof t === 'function' ? (t('toast_auth_error') || 'Ошибка авторизации') : 'Ошибка авторизации');
    });
  }
});

document.getElementById('music-vol')?.addEventListener('input', (e) => {
  state.musicVolume = parseInt(e.target.value);
  document.getElementById('music-vol-label').textContent = state.musicVolume + '%';
  setBgMusicVolume((state.musicVolume / 100) * 0.3);
  if (state.musicVolume > 0) {
    if (!musicIsPlaying) playBgMusic();
  } else {
    pauseBgMusic();
  }
  if (state.musicVolume > 0) beep(300, 0.05);
});

document.getElementById('sfx-vol')?.addEventListener('input', (e) => {
  state.sfxVolume = parseInt(e.target.value);
  document.getElementById('sfx-vol-label').textContent = e.target.value + '%';
  beep(400, 0.05); // feedback beep
});

document.getElementById('achievements-btn')?.addEventListener('click', () => {
  renderAchievements();
  document.getElementById('achievements-overlay').style.display = 'flex';
});
document.getElementById('close-achievements')?.addEventListener('click', () => {
  document.getElementById('achievements-overlay').style.display = 'none';
  showInterstitialAd();
});

document.getElementById('stats-btn')?.addEventListener('click', () => {
  renderStats();
  document.getElementById('stats-overlay').style.display = 'flex';
});
document.getElementById('close-stats')?.addEventListener('click', () => {
  document.getElementById('stats-overlay').style.display = 'none';
  showInterstitialAd();
});

document.getElementById('x2-boost-btn')?.addEventListener('click', () => {
  if (Date.now() < (state.x2BoostUntil || 0)) {
    showToast(t('toast_boost_already_active'));
    return;
  }
  confirmAd(t('ad_boost_desc'), () => {
    if (ysdk && ysdk.adv) {
      let rewarded = false;
      ysdk.adv.showRewardedVideo({
        callbacks: {
          onOpen: () => { onAdOpen(); },
          onRewarded: () => { rewarded = true; },
          onClose: () => {
            onAdClose();
            if (rewarded) {
              state.x2BoostUntil = Date.now() + 15 * 60 * 1000;
              saveGame();
              updateUI();
              showToast(t('toast_boost_activated'));
              spawnConfetti();
            }
          },
          onError: (e) => { onAdClose(); showToast(t('toast_ad_error')); }
        }
      });
    } else {
      showToast(t('toast_ad_unavailable_yandex'));
    }
  });
});

let autoClickInterval = null;
document.getElementById('auto-clicker-btn')?.addEventListener('click', () => {
  if (Date.now() < (state.autoClickActiveUntil || 0)) {
    showToast(t('toast_autoclick_already_active'));
    return;
  }
  if (Date.now() < (state.autoClickCooldownUntil || 0)) {
    const left = Math.ceil((state.autoClickCooldownUntil - Date.now()) / 1000);
    const m = Math.floor(left / 60);
    const s = left % 60;
    showToast(t('toast_cooldown_time').replace('{time}', `${m}:${s < 10 ? '0' : ''}${s}`));
    return;
  }
  confirmAd(t('ad_autoclick_desc'), () => {
    if (ysdk && ysdk.adv) {
      let rewarded = false;
      ysdk.adv.showRewardedVideo({
        callbacks: {
          onOpen: () => { onAdOpen(); },
          onRewarded: () => { rewarded = true; },
          onClose: () => {
            onAdClose();
            if (rewarded) {
              state.autoClickActiveUntil = Date.now() + 60 * 1000; // 1 min active
              state.autoClickCooldownUntil = Date.now() + 6 * 60 * 1000; // 5 min cooldown + 1 min active
              saveGame();
              updateUI();
              showToast(t('toast_autoclick_started'));
              
              if (autoClickInterval) clearInterval(autoClickInterval);
              autoClickInterval = setInterval(() => {
                if (Date.now() > state.autoClickActiveUntil) {
                  clearInterval(autoClickInterval);
                } else {
                  if (!window.isAdPlaying) doRep({ clientX: undefined, clientY: undefined });
                }
              }, 100); // 10 clicks per second
            }
          },
          onError: (e) => { onAdClose(); showToast(t('toast_ad_error')); }
        }
      });
    } else {
      showToast(t('toast_ad_unavailable_yandex'));
    }
  });
});

// Клик по всей сцене
$stage.addEventListener('pointerdown', doRep);

document.getElementById('btn-prestige')?.addEventListener('click', doPrestige);

// Keyboard shortcut: space to lift
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && e.target === document.body) {
    e.preventDefault();
    doRep();
  }

  // SECRET CHEATS: Ctrl + Shift + Number (1-9)
  if (e.ctrlKey && e.shiftKey && e.code && e.code.startsWith('Digit')) {
    const num = parseInt(e.code.replace('Digit', ''));
    if (num >= 1 && num <= 9) {
      forceTier(num);
    }
  }
});

function forceTier(level) {
  const tierDef = TIERS.find(t => t.level === level);
  if (tierDef) {
    state.totalGPEarned = tierDef.gpNeeded || 1;
    state.runGPEarned = tierDef.gpNeeded || 1;
    state.gpCount = tierDef.gpNeeded || 1;
    state.capyMassLevel = 0; // force re-evaluation
    checkTier();
    translateUI();
    updateUI();
  }
}

let isTutorialPaused = false;

/* ═══════════════════════════════════════════════════════
   RANDOM EVENTS
   ═══════════════════════════════════════════════════════ */
window.spawnRandomEvent = spawnRandomEvent;
function spawnRandomEvent() {
  if (isTutorialPaused) return;
  if (document.querySelector('.random-event')) return;
  if (state.activeEvent && Date.now() < state.activeEventUntil) return;

  const r = Math.random();
  let type = '';
  let icon = '';
  let color = '';

  if (r < 0.5) { type = 'golden'; icon = 'images/bonus/gold_dumbbells.webp'; color = 'gold'; }
  else if (r < 0.7) { type = 'shake'; icon = 'images/bonus/protein.webp'; color = '#00e5ff'; }
  else if (r < 0.85) { type = 'whistle'; icon = 'images/bonus/whistle.webp'; color = '#ff2eaa'; }
  else { type = 'suspicious'; icon = 'images/bonus/bad_protein.webp'; color = '#39ff14'; }

  const el = document.createElement('div');
  el.className = 'random-event';
  el.innerHTML = `<img src="${icon}" style="max-width:50px; max-height:50px; object-fit:contain;">`;

  // Inline styles for flying entity
  el.style.position = 'absolute';
  el.style.cursor = 'pointer';
  el.style.zIndex = '100';
  el.style.filter = `drop-shadow(0 0 10px ${color})`;
  el.style.transition = 'all 0.5s';

  // Animation pulse
  el.animate([
    { transform: 'scale(1)' },
    { transform: 'scale(1.2)' },
    { transform: 'scale(1)' }
  ], { duration: 1000, iterations: Infinity });

  const rect = $stage.getBoundingClientRect();
  const px = Math.random() * (rect.width - 60);
  const py = Math.random() * (rect.height - 100) + 20;
  el.style.left = px + 'px';
  el.style.top = py + 'px';

  const moveInterval = setInterval(() => {
    if (!el.parentNode) {
      clearInterval(moveInterval);
      return;
    }
    const newPx = Math.random() * (rect.width - 60);
    const newPy = Math.random() * (rect.height - 100) + 20;
    el.style.left = newPx + 'px';
    el.style.top = newPy + 'px';
  }, 700);

  el.addEventListener('pointerdown', (e) => {
    e.stopPropagation(); // Не кликаем на саму капибару
    if (navigator.vibrate) navigator.vibrate([50, 50, 50]);

    addBpStars(1); // +1 Звезда БП за бонус

    if (typeof progressQuest === 'function') {
      if (type === 'golden') progressQuest('dumbbell');
      else if (type === 'shake') progressQuest('protein');
      else if (type === 'whistle') progressQuest('whistle');
    }

    if (type === 'golden') {
      playSoundEffect('sounds/bonuses/гантеля.mp3');
      const reward = Math.max(50, Math.floor(getEffectiveAutoPower() * 15));
      state.gpCount += reward;
      state.totalGPEarned = (state.totalGPEarned || 0) + reward;
      state.runGPEarned = (state.runGPEarned || 0) + reward;
      state.goldenDumbbellsClicked = (state.goldenDumbbellsClicked || 0) + 1;
      spawnFloatGP(reward, true, e);
    }
    else if (type === 'shake') {
      playSoundEffect('sounds/bonuses/глотание.mp3');
      state.activeEvent = 'frenzy';
      state.activeEventUntil = Date.now() + 60000;
      state.activeEventName = t('event_protein');
      showToast(t('toast_protein_charge'));
    }
    else if (type === 'whistle') {
      playSoundEffect('sounds/bonuses/свисток.mp3');
      state.activeEvent = 'click_frenzy';
      state.activeEventUntil = Date.now() + 30000;
      state.activeEventName = t('event_motivation');
      showToast(t('toast_trainer_charge'));
    }
    else if (type === 'suspicious') {
      playSoundEffect('sounds/bonuses/глотание.mp3');
      if (Math.random() < 0.5) {
        state.activeEvent = 'mega_frenzy';
        state.activeEventUntil = Date.now() + 10000;
        state.activeEventName = t('event_mega_dose');
        showToast(t('toast_mega_dose'));
      } else {
        state.activeEvent = 'stomachache';
        state.activeEventUntil = Date.now() + 60000;
        state.activeEventName = t('event_poisoning');
        showToast(t('toast_bad_protein'));
      }
    }

    triggerShake();
    spawnConfetti();
    beep(600, 0.1); setTimeout(() => beep(800, 0.2), 100);
    translateUI();
    updateUI();
    el.remove();
  });

  $stage.appendChild(el);
  setTimeout(() => { if (el.parentNode) { clearInterval(moveInterval); el.remove(); } }, 8000);
}

/* ═══════════════════════════════════════════════════════
   GAME LOOP — Auto GP
   ═══════════════════════════════════════════════════════ */
setInterval(() => {
  if (isTutorialPaused || window.isAdPlaying) {
    updateTutorial();
    return;
  }

  if (getEffectiveAutoPower() > 0) {
    let autoMult = getEffectiveMultiplier() * getPrestigeMultiplier();
    // Event: broken equipment halves auto
    if (state.activeEvent === 'broken' && Date.now() < state.activeEventUntil) {
      autoMult *= 0.5;
    }
    // Event: protein rain doubles auto
    if (state.activeEvent === 'protein_rain' && Date.now() < state.activeEventUntil) {
      autoMult *= 2;
    }
    if (state.activeEvent === 'energy_drink' && Date.now() < state.activeEventUntil) {
      autoMult *= 3;
    }
    // Протеин: x2 авто на 60 сек
    if (state.activeEvent === 'frenzy' && Date.now() < state.activeEventUntil) {
      autoMult *= 2;
    }
    // Отравление: x0.5 авто на 60 сек
    if (state.activeEvent === 'stomachache' && Date.now() < state.activeEventUntil) {
      autoMult *= 0.5;
    }
    const amt = getEffectiveAutoPower() * autoMult;
    if (!currentTournament) {
      // GP не начисляется во время турнира
      state.gpCount += amt;
      state.totalGPEarned = (state.totalGPEarned || 0) + amt;
      state.runGPEarned = (state.runGPEarned || 0) + amt;
    }

    if (currentTournament) {
      currentTournament.hpLeft -= amt;
      updateBossUI();
    }

    const numParticles = state.lowPowerMode ? 0 : 1;
    if (numParticles > 0) {
      spawnFloatGP(amt, false);
    }
  }

  checkTier();

  // Clear expired events
  if (state.activeEvent && Date.now() >= state.activeEventUntil) {
    state.activeEvent = null;
    state.activeEventUntil = 0;
    document.getElementById('event-banner').classList.remove('visible');
  }
  // Random events
  if (Math.random() < getGoldenDumbbellRate()) spawnRandomEvent();
  updateUI();
  checkAchievements();
  updateTutorial();
}, 1000);

/* ═══════════════════════════════════════════════════════
   PRESTIGE TREE
   ═══════════════════════════════════════════════════════ */
const PRESTIGE_UPGRADES = [
  // 🔴 Active Branch
  { id: 'faster_fingers', get name() { return t('ptree_faster_fingers_name'); }, get desc() { return t('ptree_faster_fingers_desc'); }, icon: '🖱️', cost: 3, branch: 'active', req: null },
  { id: 'crit_master', get name() { return t('ptree_crit_master_name'); }, get desc() { return t('ptree_crit_master_desc'); }, icon: '🔥', cost: 6, branch: 'active', req: 'faster_fingers' },
  { id: 'combo_king', get name() { return t('ptree_combo_king_name'); }, get desc() { return t('ptree_combo_king_desc'); }, icon: '⚡', cost: 10, branch: 'active', req: 'crit_master' },
  { id: 'steroid_addict', get name() { return t('ptree_steroid_addict_name'); }, get desc() { return t('ptree_steroid_addict_desc'); }, icon: '💉', cost: 25, branch: 'active', req: 'combo_king' },
  // 🔵 Passive (AFK) Branch
  { id: 'auto_master', get name() { return t('ptree_auto_master_name'); }, get desc() { return t('ptree_auto_master_desc'); }, icon: '⚙️', cost: 3, branch: 'passive', req: null },
  { id: 'offline_god', get name() { return t('ptree_offline_god_name'); }, get desc() { return t('ptree_offline_god_desc'); }, icon: '🌙', cost: 6, branch: 'passive', req: 'auto_master' },
  { id: 'golden_dumbbell_freq', get name() { return t('ptree_golden_dumbbell_freq_name'); }, get desc() { return t('ptree_golden_dumbbell_freq_desc'); }, icon: '🧲', cost: 10, branch: 'passive', req: 'offline_god' },
  { id: 'quest_master', get name() { return t('ptree_quest_master_name'); }, get desc() { return t('ptree_quest_master_desc'); }, icon: '📜', cost: 25, branch: 'passive', req: 'golden_dumbbell_freq' },
  // 🟢 Utility (Eco) Branch
  { id: 'golden_start', get name() { return t('ptree_golden_start_name'); }, get desc() { return t('ptree_golden_start_desc'); }, icon: '🌅', cost: 3, branch: 'utility', req: null },
  { id: 'cheap_upgrades', get name() { return t('ptree_cheap_upgrades_name'); }, get desc() { return t('ptree_cheap_upgrades_desc'); }, icon: '💸', cost: 6, branch: 'utility', req: 'golden_start' },
  { id: 'golden_muscles', get name() { return t('ptree_golden_muscles_name'); }, get desc() { return t('ptree_golden_muscles_desc'); }, icon: '💛', cost: 10, branch: 'utility', req: 'cheap_upgrades' },
  { id: 'lootbox_luck', get name() { return t('ptree_lootbox_luck_name'); }, get desc() { return t('ptree_lootbox_luck_desc'); }, icon: '🎰', cost: 25, branch: 'utility', req: 'golden_muscles' },
];

function renderPrestigeTree() {
  const $list = document.getElementById('prestige-tree-list');
  const ups = state.prestigeUpgrades || {};
  const prestigeBonusPct = Math.round((getPrestigeMultiplier() - 1) * 100);
  document.getElementById('prestige-coins-display').innerHTML = `<img src="images/coin.webp" alt="Монеты" style="height: 1.2em; vertical-align: middle; transform: translateY(-0.15em); margin-right: 5px;"> ${state.prestigeCoins} <span style="font-size:0.7em; color:var(--neon-green);">(+${prestigeBonusPct}%)</span>`;

  const branches = [
    { id: 'active', title: t('prestige_branch_active') },
    { id: 'passive', title: t('prestige_branch_passive') },
    { id: 'utility', title: t('prestige_branch_eco') },
  ];

  $list.innerHTML = branches.map(b => {
    const branchUpgrades = PRESTIGE_UPGRADES.filter(u => u.branch === b.id);
    return `
      <div class="ptree-column">
        <h3>${b.title}</h3>
        ${branchUpgrades.map(up => {
      const owned = !!ups[up.id];
      const reqMet = !up.req || !!ups[up.req];
      const canBuy = !owned && reqMet && state.prestigeCoins >= up.cost;
      const locked = !owned && !reqMet;
      return `
            <div class="ptree-card ${owned ? 'bought' : ''} ${locked ? 'locked' : ''}">
              <div class="ptree-icon">${locked ? t('btn_locked') : up.icon}</div>
              <div class="ptree-info">
                <h4>${up.name}</h4>
                <p>${locked ? `${t('ptree_need_prefix')} ${PRESTIGE_UPGRADES.find(u => u.id === up.req).name}` : up.desc}</p>
              </div>
              <button class="ptree-buy-btn ${owned ? 'owned' : ''}" 
                      data-id="${up.id}" data-cost="${up.cost}"
                      ${owned ? 'disabled' : (canBuy ? '' : 'disabled')}>
                ${owned ? t('btn_bought') : `${up.cost} <img src="images/coin.webp" style="height: 1em; vertical-align: middle; transform: translateY(-0.15em);">`}
              </button>
            </div>
          `;
    }).join('')}
      </div>
    `;
  }).join('');

  // Attach buy handlers
  $list.querySelectorAll('.ptree-buy-btn:not(.owned)').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const cost = parseInt(btn.dataset.cost);
      if (state.prestigeCoins >= cost) {
        state.prestigeCoins -= cost;
        if (!state.prestigeUpgrades) state.prestigeUpgrades = {};
        state.prestigeUpgrades[id] = true;
        purchaseBeep();
        spawnConfetti();
        showToast(t('toast_ptree_unlocked').replace('{name}', PRESTIGE_UPGRADES.find(u => u.id === id).name));
        renderPrestigeTree();
        translateUI();
        updateUI();
        saveGame();
      }
    });
  });
}

document.getElementById('prestige-tree-btn')?.addEventListener('click', () => {
  renderPrestigeTree();
  document.getElementById('prestige-tree-overlay').style.display = 'flex';
});
document.getElementById('close-prestige-tree')?.addEventListener('click', () => {
  document.getElementById('prestige-tree-overlay').style.display = 'none';
});

// (golden_start is applied in doPrestige reset)

// Apply "Lucky Capy" to golden dumbbell spawn rate
function getGoldenDumbbellRate() {
  let rate = (state.prestigeUpgrades && state.prestigeUpgrades['golden_dumbbell_freq']) ? 0.08 : 0.04;
  // Gem shop: Magnet (x3 spawn rate)
  if (state.gemShopActiveUntil && Date.now() < (state.gemShopActiveUntil.magnet || 0)) {
    rate *= 3;
  }
  return rate;
}

// Apply "Extended Fever" to steroids duration
function getSteroidsDuration() {
  return (state.prestigeUpgrades && state.prestigeUpgrades['extended_fever']) ? 20000 : 10000;
}

/* ═══════════════════════════════════════════════════════
   TUTORIAL SYSTEM
   ═══════════════════════════════════════════════════════ */
function skipTutorial() {
  state.tutorialStep = 99;
  document.getElementById('tutorial-overlay').style.display = 'none';
  clearTutorialTarget();
  isTutorialPaused = false;
  saveGame();
  checkDailyAutoOpen();
}

function clearTutorialTarget() {
  document.getElementById('tutorial-cutout').style.display = 'none';
  document.getElementById('tutorial-pointer').style.display = 'none';
  state._tutSelector = null;
}

function setTutorialTarget(selector) {
  clearTutorialTarget();
  state._tutSelector = selector;
  const el = document.querySelector(selector);
  if (el) {
    const ptr = document.getElementById('tutorial-pointer');
    const cutout = document.getElementById('tutorial-cutout');
    const rect = el.getBoundingClientRect();

    cutout.style.display = 'block';
    cutout.style.left = rect.left + 'px';
    cutout.style.top = rect.top + 'px';
    cutout.style.width = rect.width + 'px';
    cutout.style.height = rect.height + 'px';

    ptr.style.display = 'block';
    ptr.style.left = (rect.left + rect.width / 2 - 20) + 'px';

    if (rect.bottom + 60 > window.innerHeight) {
      ptr.textContent = '👇';
      ptr.style.top = (rect.top - 60) + 'px';
    } else {
      ptr.textContent = '👆';
      ptr.style.top = (rect.bottom + 10) + 'px';
    }
  }
}

function showTutorialDialog(title, text, showNext) {
  document.getElementById('tutorial-overlay').style.display = 'flex';
  document.getElementById('tutorial-title').textContent = title;
  document.getElementById('tutorial-text').textContent = text;
  document.getElementById('tutorial-next-btn').style.display = showNext ? 'block' : 'none';
}

document.getElementById('tutorial-skip-btn')?.addEventListener('click', skipTutorial);
document.getElementById('tutorial-next-btn')?.addEventListener('click', () => {
  state.tutorialStep++;
  updateTutorial();
});

document.getElementById('tutorial-overlay')?.addEventListener('pointerdown', (e) => {
  if (e.target.closest('#tutorial-dialog')) return;
  const activeTarget = state._tutSelector ? document.querySelector(state._tutSelector) : null;
  if (activeTarget) {
    const rect = activeTarget.getBoundingClientRect();
    if (e.clientX >= rect.left && e.clientX <= rect.right &&
      e.clientY >= rect.top && e.clientY <= rect.bottom) {
      if (state._tutSelector === '#stage') {
        activeTarget.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: e.clientX, clientY: e.clientY }));
      } else {
        activeTarget.click();
      }
    }
  }
});

function updateTutorial() {
  if (!state.tutorialStep && state.tutorialStep !== 0) return;
  if (state.tutorialStep >= 99) {
    document.getElementById('tutorial-overlay').style.display = 'none';
    isTutorialPaused = false;
    checkDailyAutoOpen();
    return;
  }

  isTutorialPaused = true;

  switch (state.tutorialStep) {
    case 0: // Welcome
      showTutorialDialog(t('tut_welcome_title'), t('tut_welcome_text'), true);
      clearTutorialTarget();
      break;
    case 1: // First click
      showTutorialDialog(t('tut_click_title'), t('tut_click_text'), false);
      setTutorialTarget('#stage');
      if (state.gpCount >= 50) {
        state.tutorialStep = 2;
        updateTutorial();
      }
      break;
    case 2: // First upgrade
      showTutorialDialog(t('tut_upgrade_title'), t('tut_upgrade_text'), false);
      setTutorialTarget('.shop-card:first-child .buy-btn'); // Highlight first buy btn safely
      if (state.upgrades && state.upgrades['click'] >= 1) {
        state.tutorialStep = 3;
        updateTutorial();
      }
      break;
    case 3: // Auto GP info
      showTutorialDialog(t('tut_auto_title'), t('tut_auto_text'), true);
      clearTutorialTarget();
      break;
    case 4: // Random events info
      showTutorialDialog(t('tut_bonus_title'), t('tut_bonus_text'), true);
      clearTutorialTarget();
      break;
    case 5:
      skipTutorial();
      break;
  }
}

/* ═══════════════════════════════════════════════════════
   QUESTS SYSTEM
   ═══════════════════════════════════════════════════════ */
const QUEST_TEMPLATES = [
  { type: 'click', get desc() { return t('quest_click'); }, targets: [50, 100, 200], reward: [1, 2, 4] },
  { type: 'buy', get desc() { return t('quest_buy'); }, targets: [5, 10, 15], reward: [1, 2, 3] },
  { type: 'dumbbell', get desc() { return t('quest_dumbbell'); }, targets: [1, 3, 5], reward: [2, 5, 8] },
  { type: 'boss', get desc() { return t('quest_boss'); }, targets: [1, 3, 5], reward: [3, 6, 10] },
  { type: 'protein', get desc() { return t('quest_protein'); }, targets: [1, 2, 3], reward: [2, 5, 8] },
  { type: 'whistle', get desc() { return t('quest_whistle'); }, targets: [1, 2], reward: [3, 6] }
];

function generateQuest() {
  const tmpl = QUEST_TEMPLATES[Math.floor(Math.random() * QUEST_TEMPLATES.length)];
  const idx = Math.floor(Math.random() * tmpl.targets.length);
  let r = tmpl.reward[idx];
  if (state.prestigeUpgrades && state.prestigeUpgrades['quest_master']) r *= 2;
  return {
    id: 'q_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
    type: tmpl.type,
    target: tmpl.targets[idx],
    progress: 0,
    reward: r,
    completed: false
  };
}

function ensureQuests() {
  if (!state.activeQuests) state.activeQuests = [];
  while (state.activeQuests.length < 3) {
    state.activeQuests.push(generateQuest());
  }
}

function progressQuest(type, amount = 1) {
  let changed = false;
  let questsCompletedThisTime = 0;
  
  state.activeQuests.forEach(q => {
    if (!q.completed && q.type === type) {
      q.progress = Math.min(q.target, q.progress + amount);
      if (q.progress >= q.target) {
        q.completed = true;
        questsCompletedThisTime++;
        showToast(t('toast_quest_complete'));
        beep(500, 0.1); setTimeout(() => beep(700, 0.2), 150);
      }
      changed = true;
    }
  });
  if (changed) {
    if (document.getElementById('quests-overlay').style.display === 'flex') {
      renderQuests();
    }
    saveGame();
    
    if (questsCompletedThisTime > 0) {
      addBpStars(5 * questsCompletedThisTime); // +5 Звезд БП за каждый квест
    }
    if (typeof updateUI === 'function') updateUI();
  }
}

function renderQuests() {
  ensureQuests();
  const $list = document.getElementById('quests-list');
  $list.innerHTML = state.activeQuests.map((q, i) => `
    <div class="quest-card">
      <div class="quest-header">
        <span>${t('quest_' + q.type).replace('{n}', q.target)}</span>
        <span class="quest-reward">+${q.reward} 💎 | +5 ⭐</span>
      </div>
      <div style="font-size: 0.8rem; color: var(--text-dim);">${t('quest_progress')} ${q.progress} / ${q.target}</div>
      <div class="quest-progress-wrap">
        <div class="quest-progress-fill" style="width: ${(q.progress / q.target) * 100}%"></div>
      </div>
      <button class="quest-claim-btn ${q.completed ? 'ready' : ''}" data-idx="${i}">${t('quest_claim_btn')}</button>
    </div>
  `).join('');

  $list.querySelectorAll('.quest-claim-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = parseInt(e.target.dataset.idx);
      const q = state.activeQuests[idx];
      if (q.completed) {
        state.gems += q.reward;
        state.questsCompleted = (state.questsCompleted || 0) + 1;
        state.activeQuests.splice(idx, 1);
        ensureQuests();
        renderQuests();
        translateUI();
        updateUI();
        saveGame();
        spawnConfetti();
        purchaseBeep();
      }
    });
  });
}

document.getElementById('quests-btn')?.addEventListener('click', () => {
  renderQuests();
  document.getElementById('quests-overlay').style.display = 'flex';
});

document.getElementById('bp-btn')?.addEventListener('click', () => {
  renderBattlePass();
  document.getElementById('bp-overlay').classList.add('show');
});

document.getElementById('close-bp')?.addEventListener('click', () => {
  document.getElementById('bp-overlay').classList.remove('show');
});

document.getElementById('buy-premium-btn')?.addEventListener('click', () => {
  buyPremiumPass();
});
document.getElementById('close-quests')?.addEventListener('click', () => {
  document.getElementById('quests-overlay').style.display = 'none';
});

/* ═══════════════════════════════════════════════════════
   WARDROBE / SKINS
   ═══════════════════════════════════════════════════════ */
const SKINS = [
  { id: 'cool', get name() { return t('skin_cool_name'); }, icon: '🕶️', cost: 50, type: 'accessory' },
  { id: 'king', get name() { return t('skin_king_name'); }, icon: '👑', cost: 150, type: 'accessory' },
  { id: 'alien', get name() { return t('skin_alien_name'); }, icon: '👽', cost: 300, type: 'color', color: '#88ff88' },
  { id: 'demon', get name() { return t('skin_demon_name'); }, icon: '😈', cost: 600, type: 'color', color: '#ff5555' },
  { id: 'kiborg', get name() { return t('skin_kiborg_name'); }, icon: '🤖', cost: 999999, type: 'color', color: '#aabccc' },
];

function renderWardrobe() {
  const $list = document.getElementById('wardrobe-list');
  $list.innerHTML = SKINS.map(s => {
    const owned = (state.skins || []).includes(s.id);
    const active = state.activeSkin === s.id;
    return `
      <div class="skin-card ${owned ? 'owned' : ''} ${active ? 'active' : ''}" data-id="${s.id}">
        <div class="skin-icon">${s.icon}</div>
        <div class="skin-name">${s.name}</div>
        <div class="skin-cost">${owned ? (active ? t('btn_equipped') : t('btn_bought')) : (s.cost + ' 💎')}</div>
      </div>
    `;
  }).join('');

  $list.querySelectorAll('.skin-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.dataset.id;
      const s = SKINS.find(x => x.id === id);
      const owned = (state.skins || []).includes(id);

      if (owned) {
        state.activeSkin = state.activeSkin === id ? null : id; // toggle
        saveGame();
        renderWardrobe();
      } else if (state.gems >= s.cost) {
        state.gems -= s.cost;
        if (!state.skins) state.skins = [];
        state.skins.push(id);
        state.activeSkin = id;
        saveGame();
        renderWardrobe();
        translateUI();
        updateUI();
        purchaseBeep();
        spawnConfetti();
      }
    });
  });
}

document.getElementById('wardrobe-btn')?.addEventListener('click', () => {
  renderWardrobe();
  document.getElementById('wardrobe-overlay').style.display = 'flex';
});
document.getElementById('close-wardrobe')?.addEventListener('click', () => {
  document.getElementById('wardrobe-overlay').style.display = 'none';
});

/* ═══════════════════════════════════════════════════════
   BATTLE PASS (БОЕВОЙ ПРОПУСК)
   ═══════════════════════════════════════════════════════ */
function getBpRewardDesc(r) {
  switch(r.type) {
    case 'gp_multiplier': return t('bp_reward_gp_multiplier').replace('{x}', r.amount);
    case 'gems': return r.amount + ' ' + t('bp_reward_gems');
    case 'lootbox': return r.amount + ' ' + t('bp_reward_lootbox');
    case 'epic_lootbox': return r.amount + ' ' + t('bp_reward_epic_lootbox');
    case 'temp_buff': return t('bp_reward_temp_buff').replace('{mult}', r.mult).replace('{time}', r.duration/60);
    case 'free_upgrade': return t('bp_reward_free_upgrade').replace('{lvl}', r.levels).replace('{upg}', t('upgrade_'+r.upgradeId));
    case 'skin': return t('bp_reward_skin').replace('{skin}', t('skin_'+r.id+'_name'));
    case 'prestige_coins': return r.amount + ' ' + t('bp_reward_prestige_coins');
    case 'auto_boost': return t('bp_reward_auto_boost').replace('{x}', r.amount * 100);
    case 'perm_buff': return t('bp_reward_perm_buff').replace('{x}', r.amount * 100);
    case 'crit_boost': return t('bp_reward_crit_boost').replace('{x}', r.amount * 100);
    case 'mythic_skin': return t('bp_reward_mythic_skin').replace('{skin}', t('skin_'+r.id+'_name'));
  }
  return r.desc;
}

const BP_REWARDS = [
  // Ур.1
  { level: 1, starsNeeded: 10, milestone: false,
    free:    { type: 'gp_multiplier', amount: 5, desc: 'Очки кача (x5)', icon: 'images/GP.webp' },
    premium: { type: 'gems', amount: 50, desc: '50 Кристаллов', icon: '💎' } },
  // Ур.2
  { level: 2, starsNeeded: 20, milestone: true,
    free:    { type: 'lootbox', amount: 1, desc: 'Обычный Лутбокс', icon: 'images/lootbag.webp' },
    premium: { type: 'epic_lootbox', amount: 1, desc: 'Эпический Лутбокс', icon: 'images/lootbag.webp' } },
  // Ур.3
  { level: 3, starsNeeded: 30, milestone: false,
    free:    { type: 'temp_buff', duration: 120, mult: 2, desc: 'x2 Клик на 2 мин', icon: 'images/bonus/protein.webp' },
    premium: { type: 'gems', amount: 20, desc: '20 Кристаллов', icon: '💎' } },
  // Ур.4
  { level: 4, starsNeeded: 40, milestone: false,
    free:    { type: 'gp_multiplier', amount: 8, desc: 'Очки кача (x8)', icon: 'images/GP.webp' },
    premium: { type: 'free_upgrade', upgradeId: 'click', levels: 5, desc: '+5 уровней Клика', icon: 'images/bonus/whistle.webp' } },
  // Ур.5
  { level: 5, starsNeeded: 50, milestone: true,
    free:    { type: 'gems', amount: 10, desc: '10 Кристаллов', icon: '💎' },
    premium: { type: 'skin', id: 'king', name: 'Королевский', desc: 'Скин: Королевский', icon: 'images/skins/king/skin-noodle-king.webp' } },
  // Ур.6
  { level: 6, starsNeeded: 60, milestone: false,
    free:    { type: 'temp_buff', duration: 60, mult: 3, desc: 'x3 Авто на 1 мин', icon: 'images/bonus/protein.webp' },
    premium: { type: 'prestige_coins', amount: 1, desc: '1 Монета Престижа', icon: 'images/coin.webp' } },
  // Ур.7
  { level: 7, starsNeeded: 70, milestone: false,
    free:    { type: 'gp_multiplier', amount: 12, desc: 'Очки кача (x12)', icon: 'images/GP.webp' },
    premium: { type: 'auto_boost', amount: 0.05, desc: '+5% к Авто-доходу навсегда', icon: 'images/bonus/protein.webp' } },
  // Ур.8
  { level: 8, starsNeeded: 80, milestone: false,
    free:    { type: 'lootbox', amount: 1, desc: 'Обычный Лутбокс', icon: 'images/lootbag.webp' },
    premium: { type: 'gems', amount: 30, desc: '30 Кристаллов', icon: '💎' } },
  // Ур.9
  { level: 9, starsNeeded: 90, milestone: false,
    free:    { type: 'temp_buff', duration: 180, mult: 2, desc: 'x2 Всё на 3 мин', icon: 'images/bonus/bad_protein.webp' },
    premium: { type: 'free_upgrade', upgradeId: 'auto', levels: 5, desc: '+5 уровней Авто', icon: 'images/bonus/whistle.webp' } },
  // Ур.10
  { level: 10, starsNeeded: 100, milestone: true,
    free:    { type: 'prestige_coins', amount: 1, desc: '1 Монета Престижа', icon: 'images/coin.webp' },
    premium: { type: 'skin', id: 'cool', name: 'Крутой', desc: 'Скин: Крутой', icon: 'images/skins/cool/skin-noodle-cool.webp' } },
  // Ур.11
  { level: 11, starsNeeded: 110, milestone: false,
    free:    { type: 'gp_multiplier', amount: 15, desc: 'Очки кача (x15)', icon: 'images/GP.webp' },
    premium: { type: 'crit_boost', amount: 0.02, desc: '+2% Шанс крита навсегда', icon: 'images/bonus/whistle.webp' } },
  // Ур.12
  { level: 12, starsNeeded: 120, milestone: false,
    free:    { type: 'gems', amount: 8, desc: '8 Кристаллов', icon: '💎' },
    premium: { type: 'epic_lootbox', amount: 2, desc: '2 Эпических Лутбокса', icon: 'images/lootbag.webp' } },
  // Ур.13
  { level: 13, starsNeeded: 130, milestone: false,
    free:    { type: 'temp_buff', duration: 60, mult: 5, desc: 'x5 Клик на 1 мин', icon: 'images/bonus/bad_protein.webp' },
    premium: { type: 'prestige_coins', amount: 2, desc: '2 Монеты Престижа', icon: 'images/coin.webp' } },
  // Ур.14
  { level: 14, starsNeeded: 140, milestone: false,
    free:    { type: 'lootbox', amount: 2, desc: '2 Обычных Лутбокса', icon: 'images/lootbag.webp' },
    premium: { type: 'auto_boost', amount: 0.1, desc: '+10% к Авто-доходу навсегда', icon: 'images/bonus/protein.webp' } },
  // Ур.15
  { level: 15, starsNeeded: 150, milestone: true,
    free:    { type: 'gp_multiplier', amount: 20, desc: 'Очки кача (x20)', icon: 'images/GP.webp' },
    premium: { type: 'perm_buff', amount: 0.1, desc: '+10% к силе клика навсегда', icon: 'images/bonus/protein.webp' } },
  // Ур.16
  { level: 16, starsNeeded: 160, milestone: false,
    free:    { type: 'gems', amount: 12, desc: '12 Кристаллов', icon: '💎' },
    premium: { type: 'free_upgrade', upgradeId: 'shake', levels: 5, desc: '+5 уровней Протеин', icon: 'images/bonus/whistle.webp' } },
  // Ур.17
  { level: 17, starsNeeded: 170, milestone: false,
    free:    { type: 'temp_buff', duration: 120, mult: 3, desc: 'x3 Авто на 2 мин', icon: 'images/bonus/protein.webp' },
    premium: { type: 'gems', amount: 35, desc: '35 Кристаллов', icon: '💎' } },
  // Ур.18
  { level: 18, starsNeeded: 180, milestone: false,
    free:    { type: 'prestige_coins', amount: 1, desc: '1 Монета Престижа', icon: 'images/coin.webp' },
    premium: { type: 'crit_boost', amount: 0.03, desc: '+3% Шанс крита навсегда', icon: 'images/bonus/whistle.webp' } },
  // Ур.19
  { level: 19, starsNeeded: 190, milestone: false,
    free:    { type: 'gp_multiplier', amount: 25, desc: 'Очки кача (x25)', icon: 'images/GP.webp' },
    premium: { type: 'epic_lootbox', amount: 3, desc: '3 Эпических Лутбокса', icon: 'images/lootbag.webp' } },
  // Ур.20
  { level: 20, starsNeeded: 200, milestone: true,
    free:    { type: 'gems', amount: 25, desc: '25 Кристаллов', icon: '💎' },
    premium: { type: 'skin', id: 'demon', name: 'Демон', desc: 'Скин: Демон', icon: 'images/skins/demon/skin-noodle-demon.webp' } },
  // Ур.21
  { level: 21, starsNeeded: 210, milestone: false,
    free:    { type: 'temp_buff', duration: 300, mult: 2, desc: 'x2 Всё на 5 мин', icon: 'images/bonus/bad_protein.webp' },
    premium: { type: 'prestige_coins', amount: 3, desc: '3 Монеты Престижа', icon: 'images/coin.webp' } },
  // Ур.22
  { level: 22, starsNeeded: 220, milestone: false,
    free:    { type: 'lootbox', amount: 3, desc: '3 Обычных Лутбокса', icon: 'images/lootbag.webp' },
    premium: { type: 'auto_boost', amount: 0.15, desc: '+15% к Авто-доходу навсегда', icon: 'images/bonus/protein.webp' } },
  // Ур.23
  { level: 23, starsNeeded: 230, milestone: false,
    free:    { type: 'gems', amount: 15, desc: '15 Кристаллов', icon: 'images/bonus/gold_dumbbells.webp' },
    premium: { type: 'free_upgrade', upgradeId: 'creatine', levels: 3, desc: '+3 уровня Креатина', icon: 'images/bonus/whistle.webp' } },
  // Ур.24
  { level: 24, starsNeeded: 240, milestone: false,
    free:    { type: 'gp_multiplier', amount: 30, desc: 'Очки кача (x30)', icon: 'images/GP.webp' },
    premium: { type: 'gems', amount: 50, desc: '50 Кристаллов', icon: 'images/bonus/gold_dumbbells.webp' } },
  // Ур.25
  { level: 25, starsNeeded: 250, milestone: true,
    free:    { type: 'prestige_coins', amount: 2, desc: '2 Монеты Престижа', icon: 'images/coin.webp' },
    premium: { type: 'skin', id: 'alien', name: 'Инопланетянин', desc: 'Скин: Пришелец', icon: 'images/skins/alien/skin-noodle-alien.webp' } },
  // Ур.26
  { level: 26, starsNeeded: 260, milestone: false,
    free:    { type: 'temp_buff', duration: 120, mult: 5, desc: 'x5 Клик на 2 мин', icon: 'images/bonus/bad_protein.webp' },
    premium: { type: 'crit_boost', amount: 0.05, desc: '+5% Шанс крита навсегда', icon: 'images/bonus/whistle.webp' } },
  // Ур.27
  { level: 27, starsNeeded: 270, milestone: false,
    free:    { type: 'gems', amount: 20, desc: '20 Кристаллов', icon: 'images/bonus/gold_dumbbells.webp' },
    premium: { type: 'prestige_coins', amount: 5, desc: '5 Монет Престижа', icon: 'images/coin.webp' } },
  // Ур.28
  { level: 28, starsNeeded: 280, milestone: false,
    free:    { type: 'lootbox', amount: 5, desc: '5 Обычных Лутбоксов', icon: 'images/lootbag.webp' },
    premium: { type: 'perm_buff', amount: 0.15, desc: '+15% к силе клика навсегда', icon: 'images/bonus/protein.webp' } },
  // Ур.29
  { level: 29, starsNeeded: 290, milestone: false,
    free:    { type: 'gp_multiplier', amount: 50, desc: 'Очки кача (x50)', icon: 'images/GP.webp' },
    premium: { type: 'auto_boost', amount: 0.25, desc: '+25% к Авто-доходу навсегда', icon: 'images/bonus/protein.webp' } },
  // Ур.30 — ФИНАЛ
  { level: 30, starsNeeded: 300, milestone: true,
    free:    { type: 'prestige_coins', amount: 5, desc: '5 Монет Престижа', icon: 'images/coin.webp' },
    premium: { type: 'mythic_skin', id: 'bp_cyborg', name: 'Киборг-Капибара', desc: 'Мифический скин + 100 💎', icon: 'images/skins/kiborg/skin-noodle-kiborg.webp' } },
];

function addBpStars(amount) {
  if (state.bpLevel >= 30) return; // Max level reached
  state.bpStars += amount;
  
  let leveledUp = false;
  while (state.bpLevel <= 30) {
    let nextTier = BP_REWARDS[state.bpLevel - 1];
    if (nextTier && state.bpStars >= nextTier.starsNeeded) {
      state.bpStars -= nextTier.starsNeeded;
      state.bpLevel++;
      leveledUp = true;
    } else {
      break;
    }
  }

  if (leveledUp) {
    showToast(`${t('toast_bp_level')} ${state.bpLevel}!`);
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
  }
  saveGame();
}

function buyPremiumPass() {
  if (state.hasPremiumBP) return;
  if (payments) {
    payments.purchase({ id: 'premium_bp' }).then(purchase => {
      state.hasPremiumBP = true;
      showToast(t('toast_bp_premium_activated'));
      saveGame();
      renderBattlePass();
      // Обязательно консьюмим покупку
      payments.consumePurchase(purchase.purchaseToken).catch(err => console.error('Consume failed', err));
    }).catch(err => {
      console.error('Purchase failed', err);
      showToast(t('toast_purchase_error'));
    });
  } else {
    showToast(t('toast_payments_not_init'));
  }
}

function claimBpReward(levelIndex, isPremium) {
  if (state.bpLevel < levelIndex + 1) {
    showToast(t('toast_bp_level_not_reached'));
    return;
  }
  
  if (isPremium && !state.hasPremiumBP) {
    showToast(t('toast_bp_premium_required'));
    return;
  }

  let claimArray = isPremium ? state.bpClaimedPremium : state.bpClaimedFree;
  if (claimArray.includes(levelIndex)) {
    showToast(t('toast_bp_already_claimed'));
    return;
  }

  let reward = isPremium ? BP_REWARDS[levelIndex].premium : BP_REWARDS[levelIndex].free;
  
  // Grant reward
  if (reward.type === 'gp_multiplier') {
    let amt = Math.max(100, getEffectiveAutoPower() * reward.amount);
    state.gpCount += amt;
    state.totalGPEarned = (state.totalGPEarned || 0) + amt;
  } else if (reward.type === 'gems') {
    state.gems += reward.amount;
  } else if (reward.type === 'lootbox' || reward.type === 'epic_lootbox') {
    // Show the lootbox UI and automatically open it
    const isEpic = reward.type === 'epic_lootbox';
    document.getElementById('lootbox-overlay').style.display = 'flex';
    document.getElementById('lootbox-bag').innerHTML = '<img src="images/lootbag.webp" alt="Lootbag" style="height: 120px; object-fit: contain;">';
    document.getElementById('lootbox-result').textContent = '...';
    
    // Auto start the roulette visually
    setTimeout(() => {
        processLootbox(isEpic, reward.amount || 1);
    }, 500);
  } else if (reward.type === 'prestige_coins') {
    state.prestigeCoins += reward.amount;
  } else if (reward.type === 'skin' || reward.type === 'mythic_skin') {
    if (!state.skins.includes(reward.id)) state.skins.push(reward.id);
    if (reward.type === 'mythic_skin') state.gems += 100;
  } else if (reward.type === 'perm_buff') {
    state.bpClickBuff = (state.bpClickBuff || 0) + reward.amount;
  } else if (reward.type === 'temp_buff') {
    // Activate a temporary event buff
    state.activeEvent = 'bp_buff';
    state.activeEventUntil = Date.now() + (reward.duration || 120) * 1000;
    state.activeEventName = getBpRewardDesc(reward);
    state.activeEventMult = reward.mult || 2;
  } else if (reward.type === 'free_upgrade') {
    // Grant free upgrade levels
    const id = reward.upgradeId;
    if (!state.upgrades) state.upgrades = {};
    state.upgrades[id] = (state.upgrades[id] || 0) + (reward.levels || 1);
  } else if (reward.type === 'auto_boost') {
    state.bpAutoBuff = (state.bpAutoBuff || 0) + reward.amount;
  } else if (reward.type === 'crit_boost') {
    state.bpCritBuff = (state.bpCritBuff || 0) + reward.amount;
  } else if (reward.type === 'location') {
    if (!LOCATIONS.find(l => l.id === 'olympus')) {
      LOCATIONS.push({ id: 'olympus', get name() { return t('loc_olympus_name'); }, get desc() { return t('loc_olympus_desc'); }, multiplier: 150, reqTier: 99, bgImage: 'url("images/backgrounds/olympus.webp")' });
    }
  }

  claimArray.push(levelIndex);
  showToast(t('toast_bp_reward_received').replace('{desc}', getBpRewardDesc(reward)));
  saveGame();
  renderBattlePass();
  updateUI();
}

function hasUnclaimedBPRewards() {
  if (!state.bpLevel) return false;
  for (let i = 0; i < Math.min(state.bpLevel, 30); i++) {
    const freeClaimed = (state.bpClaimedFree || []).includes(i);
    const premiumClaimed = (state.bpClaimedPremium || []).includes(i);
    if (!freeClaimed) return true;
    if (state.hasPremiumBP && !premiumClaimed) return true;
  }
  return false;
}

function renderBattlePass() {
  document.getElementById('bp-level-display').textContent = `${t('bp_level_display')} ${state.bpLevel}`;
  let currentTier = BP_REWARDS[Math.min(state.bpLevel, 30) - 1];

  // Progress bar
  const $fill = document.getElementById('bp-progress-bar-fill');
  if (state.bpLevel >= 30) {
    document.getElementById('bp-stars-display').textContent = t('bp_max');
    $fill.style.width = '100%';
  } else {
    let pct = Math.min(100, (state.bpStars / currentTier.starsNeeded) * 100);
    $fill.style.width = pct + '%';
    document.getElementById('bp-stars-display').textContent = `${state.bpStars} / ${currentTier.starsNeeded}`;
  }

  // Premium button state
  const btnBuy = document.getElementById('buy-premium-btn');
  if (state.hasPremiumBP) {
    btnBuy.innerHTML = `<span style="font-size:1.3rem;">✅</span> ${t('bp_premium_active')}`;
    btnBuy.disabled = true;
    btnBuy.classList.add('active');
  } else {
    btnBuy.innerHTML = `<img src="images/coin.webp" style="height:1.5em;vertical-align:middle;margin-right:5px;">${t('bp_buy_premium')}`;
    btnBuy.disabled = false;
    btnBuy.classList.remove('active');
  }

  const $list = document.getElementById('bp-tiers-list');
  $list.innerHTML = '';

  let scrollToEl = null;

  BP_REWARDS.forEach((tier, index) => {
    const isCurrent = state.bpLevel === tier.level;
    const isPassed = state.bpLevel > tier.level;
    const canClaim = state.bpLevel >= tier.level;
    const freeClaimed = (state.bpClaimedFree || []).includes(index);
    const premiumClaimed = (state.bpClaimedPremium || []).includes(index);

    // Row
    const row = document.createElement('div');
    row.className = 'bp-tier-row';
    if (isCurrent) row.classList.add('current');
    else if (isPassed) row.classList.add('passed');
    else row.classList.add('locked');
    if (tier.milestone) row.classList.add('milestone');

    // ── Free reward card ──
    const freeCard = document.createElement('div');
    freeCard.className = 'bp-reward-card free';
    let freeIcon = tier.free.icon || 'images/GP.webp';
    let freeIconHtml = freeIcon.includes('/') ? `<img class="bp-reward-icon" src="${freeIcon}" alt="">` : `<div class="bp-reward-icon" style="display:flex;align-items:center;justify-content:center;font-size:32px;">${freeIcon}</div>`;
    freeCard.innerHTML = `
      ${freeIconHtml}
      <div class="bp-reward-desc">${getBpRewardDesc(tier.free)}</div>
    `;
    let btnFree = document.createElement('button');
    btnFree.className = 'bp-claim-btn';
    if (freeClaimed) {
      btnFree.textContent = '✔️';
      btnFree.classList.add('claimed');
    } else if (canClaim) {
      btnFree.textContent = t('btn_claim');
      btnFree.classList.add('free-claim');
      btnFree.onclick = () => claimBpReward(index, false);
    } else {
      btnFree.textContent = t('btn_locked');
      btnFree.classList.add('locked-btn');
    }
    freeCard.appendChild(btnFree);

    // ── Level circle (Diamond) ──
    const levelCircle = document.createElement('div');
    levelCircle.className = 'bp-level-circle';
    levelCircle.innerHTML = `<span class="bp-level-circle-inner">${tier.level}</span>`;

    // ── Premium reward card ──
    const premCard = document.createElement('div');
    premCard.className = 'bp-reward-card premium';
    let premIcon = tier.premium.icon || '💎';
    let premIconHtml = premIcon.includes('/') ? `<img class="bp-reward-icon" src="${premIcon}" alt="">` : `<div class="bp-reward-icon" style="display:flex;align-items:center;justify-content:center;font-size:32px;filter:drop-shadow(0 2px 5px rgba(0,0,0,0.5));">${premIcon}</div>`;
    premCard.innerHTML = `
      ${premIconHtml}
      <div class="bp-reward-desc">${getBpRewardDesc(tier.premium)}</div>
    `;

    let btnPrem = document.createElement('button');
    btnPrem.className = 'bp-claim-btn';
    if (premiumClaimed) {
      btnPrem.textContent = '✔️';
      btnPrem.classList.add('claimed');
    } else if (canClaim && state.hasPremiumBP) {
      btnPrem.textContent = t('btn_claim');
      btnPrem.classList.add('premium-claim');
      btnPrem.onclick = () => claimBpReward(index, true);
    } else {
      btnPrem.textContent = t('btn_locked');
      btnPrem.classList.add('locked-btn');
    }
    premCard.appendChild(btnPrem);

    // Lock overlay on premium if no premium pass
    if (!state.hasPremiumBP && !premiumClaimed) {
      const lockOverlay = document.createElement('div');
      lockOverlay.className = 'bp-lock-overlay';
      lockOverlay.innerHTML = t('btn_locked');
      premCard.appendChild(lockOverlay);
    }

    row.appendChild(freeCard);
    row.appendChild(levelCircle);
    row.appendChild(premCard);
    $list.appendChild(row);

    if (isCurrent) scrollToEl = row;
  });

  // Auto-scroll to current level
  if (scrollToEl) {
    setTimeout(() => scrollToEl.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
  }
}

/* ═══════════════════════════════════════════════════════
   LOCATIONS SYSTEM
   ═══════════════════════════════════════════════════════ */
function renderLocations() {
  const $list = document.getElementById('locations-list');
  $list.innerHTML = LOCATIONS.map(loc => {
    const unlocked = state.capyMassLevel >= loc.reqTier;
    const active = state.currentLocation === loc.id;
    return `
      <div class="location-card ${unlocked ? 'unlocked' : 'locked'} ${active ? 'active' : ''}" data-id="${loc.id}">
        <div class="location-info">
          <h4>${loc.name}</h4>
          <p>${loc.desc}</p>
        </div>
        <div class="location-status">
          ${active ? t('location_current') : (unlocked ? t('location_select') : `${t('location_req')} ${loc.reqTier}`)}
        </div>
      </div>
    `;
  }).join('');

  $list.querySelectorAll('.location-card.unlocked').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.dataset.id;
      if (state.currentLocation !== id) {
        state.currentLocation = id;
        saveGame();
        renderLocations();
        translateUI();
        updateUI();
        triggerShake();
        spawnConfetti();
        beep(400, 0.1); setTimeout(() => beep(600, 0.2), 150);
        showInterstitialAd();
      }
    });
  });
}

document.getElementById('locations-btn')?.addEventListener('click', () => {
  renderLocations();
  document.getElementById('locations-overlay').style.display = 'flex';
});
document.getElementById('close-locations')?.addEventListener('click', () => {
  document.getElementById('locations-overlay').style.display = 'none';
});

/* ═══════════════════════════════════════════════════════
   TOURNAMENT LOGIC
   ═══════════════════════════════════════════════════════ */
let tournamentInterval = null;

function showCustomConfirm(title, text, onYes, onClose) {
  const overlay = document.getElementById('confirm-overlay');
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-text').textContent = text;

  const btnYes = document.getElementById('confirm-yes');
  const btnNo = document.getElementById('confirm-no');

  // Клонируем кнопки для сброса старых обработчиков
  const newBtnYes = btnYes.cloneNode(true);
  const newBtnNo = btnNo.cloneNode(true);
  btnYes.parentNode.replaceChild(newBtnYes, btnYes);
  btnNo.parentNode.replaceChild(newBtnNo, btnNo);

  const close = () => { overlay.style.display = 'none'; if (onClose) onClose(); };

  newBtnYes.addEventListener('click', () => { close(); if (onYes) onYes(); });
  newBtnNo.addEventListener('click', close);

  overlay.style.display = 'flex';
}

function startTournament() {
  if (state.tournamentCooldownUntil > Date.now()) {
    let updateTimer = null;

    const updateTitle = () => {
      const left = Math.ceil((state.tournamentCooldownUntil - Date.now()) / 1000);
      if (left <= 0) {
        document.getElementById('confirm-overlay').style.display = 'none';
        if (updateTimer) clearInterval(updateTimer);
        startTournament(); // запускаем, так как время вышло
        return;
      }
      const m = Math.floor(left / 60);
      const s = left % 60;
      document.getElementById('confirm-title').textContent = t('tournament_cooldown_title').replace('{time}', `${m}:${s < 10 ? '0' : ''}${s}`);
    };

    showCustomConfirm('', t('ad_tournament_desc'), () => {
      if (ysdk && ysdk.adv) {
        let rewarded = false;
        ysdk.adv.showRewardedVideo({
          callbacks: {
            onOpen: () => { onAdOpen(); },
            onRewarded: () => { rewarded = true; },
            onClose: () => {
              onAdClose();
              if (rewarded) {
                state.tournamentCooldownUntil = 0;
                saveGame();
                translateUI();
                updateUI();
                showToast(t('toast_cooldown_reset'));
                startTournament();
              }
            },
            onError: (e) => { onAdClose(); console.error(e); showToast(t('toast_ad_error')); }
          }
        });
      } else {
        showToast(t('toast_ad_unavailable'));
      }
    }, () => {
      if (updateTimer) clearInterval(updateTimer);
    });

    updateTitle();
    updateTimer = setInterval(updateTitle, 1000);

    return;
  }
  if (currentTournament) return;

  const boss = BOSSES.find(b => b.level === state.tournamentLevel) || BOSSES[BOSSES.length - 1];

  // Scale HP for boss level > 5
  const extraLevels = Math.max(0, state.tournamentLevel - 5);
  const hpMultiplier = Math.pow(10, extraLevels);
  const maxHp = boss.hp * hpMultiplier;

  currentTournament = {
    bossId: boss.level,
    name: boss.name,
    maxHp: maxHp,
    hpLeft: maxHp,
    reward: boss.reward + (extraLevels * 100),
    endTime: Date.now() + 30000 // 30 seconds
  };

  document.getElementById('boss-name').textContent = `${currentTournament.name}`;

  const bossImages = {
    1: 'images/bosses/boss_1_goose_1787328699405.webp',
    2: 'images/bosses/boss_2_kangaroo_1787328709078.webp',
    3: 'images/bosses/boss_3_crocodile_1787328720249.webp',
    4: 'images/bosses/boss_4_bear_1787328730155.webp',
    5: 'images/bosses/boss_5_cat_1787328741084.webp'
  };
  document.getElementById('boss-avatar').src = bossImages[currentTournament.bossId] || bossImages[5];

  document.getElementById('tournament-arena').style.display = 'flex';

  updateBossUI();

  tournamentInterval = setInterval(() => {
    if (!currentTournament) {
      clearInterval(tournamentInterval);
      return;
    }
    updateBossUI();

    if (currentTournament.hpLeft <= 0) {
      endTournament(true);
    } else if (Date.now() >= currentTournament.endTime) {
      endTournament(false);
    }
  }, 30);
}

/* ═══════════════════════════════════════════════════════
   IN-APP PURCHASES (DONAT)
   ═══════════════════════════════════════════════════════ */
const IAP_ITEMS = [
  { id: 'no_ads', get name() { return t('iap_no_ads_name'); }, get desc() { return t('iap_no_ads_desc'); }, icon: '🚫', get price() { return '99 ' + t('currency_yan'); } },
  { id: 'gems_100', get name() { return t('iap_gems_100_name'); }, get desc() { return t('iap_gems_100_desc'); }, icon: '💎', get price() { return '49 ' + t('currency_yan'); } },
  { id: 'starter_pack', get name() { return t('iap_starter_pack_name'); }, get desc() { return t('iap_starter_pack_desc'); }, icon: '🎁', get price() { return '149 ' + t('currency_yan'); } },
];

function renderDonateShop() {
  const $list = document.getElementById('donate-list');
  if (!$list) return;
  $list.innerHTML = '';
  IAP_ITEMS.forEach(item => {
    if (item.id === 'no_ads' && state.noAds) return;
    
    let displayPrice = item.price;
    if (window.catalogProducts) {
      const prod = window.catalogProducts.find(p => p.id === item.id);
      if (prod && prod.price) {
        displayPrice = prod.price;
      }
    }
    
    $list.innerHTML += `
      <div class="shop-card" style="border-color: var(--gold);">
        <div class="card-meta">
          <span class="card-title">${item.icon} ${item.name}</span>
        </div>
        <div class="card-desc">${item.desc}</div>
        <div class="card-meta" style="margin-top: 5px;">
          <button class="buy-btn" style="background: linear-gradient(135deg, var(--gold), #ff8c00); color: #000; width: 100%;" onclick="buyIAP('${item.id}')">${t('iap_buy_btn')} (${displayPrice})</button>
        </div>
      </div>
    `;
  });
}

window.buyIAP = function(id) {
  if (payments) {
    payments.purchase({ id: id }).then(purchase => {
      if (id === 'no_ads') {
        state.noAds = true;
        showToast(t('toast_no_ads'));
      } else if (id === 'gems_100') {
        state.gems += 100;
        showToast(t('toast_gems_100'));
      } else if (id === 'starter_pack') {
        state.gems += 100;
        state.prestigeCoins += 1;
        showToast(t('toast_starter_pack'));
        document.getElementById('lootbox-overlay').style.display = 'flex';
        document.getElementById('lootbox-bag').innerHTML = '<img src="images/lootbag.webp" alt="Lootbag" style="height: 120px; object-fit: contain;">';
        document.getElementById('lootbox-result').textContent = '...';
        setTimeout(() => {
            processLootbox(true, 1);
        }, 500);
      }
      saveGame();
      updateUI();
      renderDonateShop();
      payments.consumePurchase(purchase.purchaseToken).catch(err => console.error('Consume failed', err));
    }).catch(err => {
      console.error('Purchase failed', err);
      showToast(t('toast_purchase_error'));
    });
  } else {
    showToast(t('toast_payments_not_init_yandex'));
  }
}

/* ═══════════════════════════════════════════════════════
   GEM SHOP
   ═══════════════════════════════════════════════════════ */
const GEM_SHOP_ITEMS = [
  { id: 'protein', get name() { return t('gem_shop_protein'); }, get desc() { return t('gem_shop_protein_desc'); }, icon: '🥛', cost: 15, durationMs: 5 * 60 * 1000, cooldownMs: 30 * 60 * 1000 },
  { id: 'berserk', get name() { return t('gem_shop_berserk'); }, get desc() { return t('gem_shop_berserk_desc'); }, icon: '🔥', cost: 30, durationMs: 2 * 60 * 1000, cooldownMs: 45 * 60 * 1000 },
  { id: 'golden_hour', get name() { return t('gem_shop_golden_hour'); }, get desc() { return t('gem_shop_golden_hour_desc'); }, icon: '⏳', cost: 40, durationMs: 10 * 60 * 1000, cooldownMs: 60 * 60 * 1000 },
  { id: 'magnet', get name() { return t('gem_shop_magnet'); }, get desc() { return t('gem_shop_magnet_desc'); }, icon: '🧲', cost: 20, durationMs: 5 * 60 * 1000, cooldownMs: 30 * 60 * 1000 },
  { id: 'luck', get name() { return t('gem_shop_luck'); }, get desc() { return t('gem_shop_luck_desc'); }, icon: '🍀', cost: 25, durationMs: 5 * 60 * 1000, cooldownMs: 30 * 60 * 1000 },
  { id: 'mega_combo', get name() { return t('gem_shop_mega_combo'); }, get desc() { return t('gem_shop_mega_combo_desc'); }, icon: '💥', cost: 35, durationMs: 3 * 60 * 1000, cooldownMs: 45 * 60 * 1000 }
];

let gemShopRendered = false;
function renderGemShop(force = false) {
  const $list = document.getElementById('gem-shop-list');
  const $balance = document.getElementById('gem-shop-gems-val');
  if (!$list || !$balance) return;

  $balance.textContent = state.gems || 0;

  const now = Date.now();

  if (!gemShopRendered || force) {
    $list.innerHTML = GEM_SHOP_ITEMS.map(item => `
      <div class="shop-card" id="gem-item-${item.id}">
        <div class="card-meta">
          <span class="card-title" style="font-size:1.2rem;">${item.icon} ${item.name}</span>
          <span class="card-level" id="gem-status-${item.id}"></span>
        </div>
        <div class="card-desc">${item.desc}</div>
        <div class="card-meta">
          <span class="card-cost" style="color:var(--neon-blue);">${item.cost} 💎</span>
          <div style="display:flex; gap: 5px;">
            <button class="buy-btn green" id="gem-btn-${item.id}" onclick="buyGemShopItem('${item.id}')"></button>
          </div>
        </div>
      </div>
    `).join('');
    gemShopRendered = true;
  }

  GEM_SHOP_ITEMS.forEach(item => {
    const activeUntil = state.gemShopActiveUntil?.[item.id] || 0;
    const cooldownUntil = state.gemShopCooldownUntil?.[item.id] || 0;
    
    const isActive = now < activeUntil;
    const isCooldown = !isActive && now < cooldownUntil;
    const canBuy = !isActive && !isCooldown && (state.gems || 0) >= item.cost;

    const $item = document.getElementById(`gem-item-${item.id}`);
    const $status = document.getElementById(`gem-status-${item.id}`);
    const $btn = document.getElementById(`gem-btn-${item.id}`);

    if (!$item || !$status || !$btn) return;

    if (isActive) {
      const left = Math.ceil((activeUntil - now) / 1000);
      const m = Math.floor(left / 60);
      const s = left % 60;
      const timeStr = `${m}:${s < 10 ? '0' : ''}${s}`;
      $status.innerHTML = `<span style="color:var(--neon-green); text-shadow:0 0 5px rgba(57,255,20,0.5);">⚡ ${timeStr}</span>`;
      $btn.textContent = t('gem_shop_btn_active');
      $btn.className = 'buy-btn green';
      $btn.disabled = true;
      $item.style.borderColor = 'var(--neon-green)';
      $item.style.boxShadow = '0 0 15px rgba(57, 255, 20, 0.2)';
    } else if (isCooldown) {
      const left = Math.ceil((cooldownUntil - now) / 1000);
      const m = Math.floor(left / 60);
      const s = left % 60;
      const timeStr = `${m}:${s < 10 ? '0' : ''}${s}`;
      $status.innerHTML = `<span style="color:var(--text-dim);">⏳ ${timeStr}</span>`;
      $btn.textContent = t('gem_shop_btn_cooldown');
      $btn.className = 'buy-btn green';
      $btn.disabled = true;
      $item.style.borderColor = 'var(--border)';
      $item.style.boxShadow = 'none';
      $item.style.opacity = '0.6';
    } else {
      $status.innerHTML = '';
      $btn.textContent = t('gem_shop_btn_buy');
      $btn.className = 'buy-btn green';
      $btn.style.background = '';
      $btn.style.color = '';
      $btn.disabled = !canBuy;
      $item.style.borderColor = 'var(--border)';
      $item.style.boxShadow = 'none';
      $item.style.opacity = '1';
    }
  });
}

window.buyGemShopItem = function(id) {
  const item = GEM_SHOP_ITEMS.find(x => x.id === id);
  if (!item) return;

  const now = Date.now();
  const activeUntil = state.gemShopActiveUntil?.[id] || 0;
  const cooldownUntil = state.gemShopCooldownUntil?.[id] || 0;

  if (now < activeUntil) {
    showToast(t('toast_gem_shop_active'));
    return;
  }
  
  if (now < cooldownUntil) {
    const left = Math.ceil((cooldownUntil - now) / 1000);
    const m = Math.floor(left / 60);
    const s = left % 60;
    const timeStr = `${m}:${s < 10 ? '0' : ''}${s}`;
    showToast(t('toast_gem_shop_cooldown').replace('{time}', timeStr));
    return;
  }

  if ((state.gems || 0) < item.cost) {
    showToast(t('toast_gem_shop_not_enough'));
    return;
  }

  state.gems -= item.cost;
  if (!state.gemShopActiveUntil) state.gemShopActiveUntil = {};
  if (!state.gemShopCooldownUntil) state.gemShopCooldownUntil = {};

  state.gemShopActiveUntil[id] = now + item.durationMs;
  state.gemShopCooldownUntil[id] = now + item.durationMs + item.cooldownMs;

  showToast(t('toast_gem_shop_bought').replace('{name}', item.name));
  purchaseBeep();
  spawnConfetti();

  saveGame();
  updateUI();
  
  // Force full render to show new state
  renderGemShop();
}


function updateBossUI() {
  if (!currentTournament) return;
  const now = Date.now();

  // Total tournament duration is 30 seconds
  const totalTime = 30000;
  const timeElapsed = Math.max(0, now - (currentTournament.endTime - totalTime));
  const timeLeftSec = Math.max(0, (currentTournament.endTime - now) / 1000);

  const formattedTime = timeLeftSec.toFixed(1);
  document.getElementById('boss-timer').textContent = `00:${parseFloat(formattedTime) < 10 ? '0' : ''}${formattedTime}`;

  const timePct = Math.min(1, timeElapsed / totalTime);
  const damagePct = 1 - (currentTournament.hpLeft / currentTournament.maxHp);

  // Center is 50%. Boss pulls right (+40%), Player pulls left (-40%)
  let pos = 50 + (timePct * 40) - (damagePct * 40);
  pos = Math.max(10, Math.min(90, pos)); // clamp between 10% and 90%

  document.getElementById('tug-of-war-marker').style.left = pos + '%';
}

function endTournament(success) {
  if (!currentTournament) return;

  document.getElementById('tournament-arena').style.display = 'none';
  clearInterval(tournamentInterval);

  if (success) {
    if (typeof progressQuest === 'function') progressQuest('boss');
    showToast(t('toast_boss_defeated').replace('{reward}', currentTournament.reward));
    state.gems = (state.gems || 0) + currentTournament.reward;
    state.tournamentLevel++;
    addBpStars(10); // +10 Звезд БП за босса
    spawnConfetti();
    spawnConfetti();
    spawnConfetti();
    beep(800, 0.2); setTimeout(() => beep(1000, 0.3), 200);
  } else {
    showToast(t('toast_boss_timeout'));
    state.tournamentCooldownUntil = Date.now() + 5 * 60000; // 5 mins cooldown
    beep(200, 0.3); setTimeout(() => beep(150, 0.4), 300);
  }

  currentTournament = null;
  saveGame();
  translateUI();
  updateUI();
}

document.getElementById('tournament-btn')?.addEventListener('click', () => {
  if (state.tournamentCooldownUntil > Date.now()) {
    startTournament(); // handles the cooldown prompt
  } else {
    document.getElementById('tournament-overlay').style.display = 'flex';
  }
});

document.getElementById('start-boss-btn')?.addEventListener('click', () => {
  document.getElementById('tournament-overlay').style.display = 'none';
  startTournament();
});

document.getElementById('close-tournament')?.addEventListener('click', () => {
  document.getElementById('tournament-overlay').style.display = 'none';
});

/* ═══════════════════════════════════════════════════════
   LOOTBOX LOGIC
   ═══════════════════════════════════════════════════════ */
document.getElementById('lootbox-btn')?.addEventListener('click', () => {
  document.getElementById('lootbox-overlay').style.display = 'flex';
  const resElem = document.getElementById('lootbox-result');
  resElem.setAttribute('data-i18n', 'lootbox_ready');
  resElem.innerHTML = t('lootbox_ready');
  document.getElementById('open-lootbox-btn').disabled = false;
  document.getElementById('open-lootbox-btn').textContent = t('lootbox_open_25');
  document.getElementById('lootbox-bag').classList.remove('bag-shaking');
  document.getElementById('lootbox-bag').innerHTML = '<img src="images/lootbag.webp" alt="Lootbag" style="height: 120px; object-fit: contain;">';

  const maxAds = 3;
  const adsWatched = state.lootboxAdsWatched || 0;
  const $adBtn = document.getElementById('open-lootbox-ad-btn');

  if (adsWatched < maxAds) {
    $adBtn.style.display = 'block';
    document.getElementById('lootbox-ad-count').textContent = (maxAds - adsWatched);
  } else {
    $adBtn.style.display = 'none';
  }
});

document.getElementById('rewarded-ad-btn')?.addEventListener('click', () => {
  confirmAd(t('ad_daily_gems'), () => {
    if (ysdk && ysdk.adv) {
      let rewarded = false;
      ysdk.adv.showRewardedVideo({
        callbacks: {
          onOpen: () => { onAdOpen(); },
          onRewarded: () => { rewarded = true; },
          onClose: () => {
            onAdClose();
            if (rewarded) {
              state.gems += 15;
              saveGame();
              translateUI();
              updateUI();
              showToast(t('toast_reward_ad_success'));
              spawnConfetti();
              beep(600, 0.1); setTimeout(() => beep(800, 0.2), 100);
            }
            document.getElementById('rewarded-ad-btn').style.display = 'none';
          },
          onError: (e) => { onAdClose(); console.error('Error while showing rewarded ad:', e); showToast(t('toast_ad_error')); }
        }
      });
    } else {
      showToast(t('toast_ad_unavailable'));
    }
  });
});

document.getElementById('close-lootbox')?.addEventListener('click', () => {
  document.getElementById('lootbox-overlay').style.display = 'none';
});

function processLootbox(isEpic = false, multiplier = 1) {
  playSoundEffect('sounds/case/go-new-gambling.mp3');
  const $btn = document.getElementById('open-lootbox-btn');
  const $adBtn = document.getElementById('open-lootbox-ad-btn');
  const $container = document.getElementById('lootbox-roulette-container');
  const $tape = document.getElementById('lootbox-roulette-tape');
  const $bag = document.getElementById('lootbox-bag');
  const $res = document.getElementById('lootbox-result');

  $btn.disabled = true;
  $adBtn.disabled = true;
  $btn.textContent = t('lootbox_opening');
  $res.removeAttribute('data-i18n');
  $res.textContent = '...';

  $bag.style.display = 'none';
  $container.style.display = 'block';

  // Reset tape
  $tape.style.transition = 'none';
  $tape.style.transform = 'translateX(0)';
  $tape.innerHTML = '';

  const tierArr = ['noodle', 'noob', 'toned', 'jork', 'athlete', 'bodybuilder', 'mr_olimpia', 'gigachad', 'god'];
  let currentTierIdx = Math.min(8, Math.max(0, state.capyMassLevel - 1));
  let currentTier = tierArr[currentTierIdx];

  let chanceSkin = (state.prestigeUpgrades && state.prestigeUpgrades['lootbox_luck']) ? 0.30 : 0.20;
  if (isEpic) chanceSkin += 0.25; // Epic adds 25% to skin chance

  let thresholdGems = (isEpic) ? 0.15 : ((chanceSkin >= 0.30) ? 0.20 : 0.25);
  let thresholdGP = thresholdGems + (isEpic ? 0.15 : 0.30);
  let thresholdPrestige = thresholdGP + (isEpic ? 0.05 : 0.02);
  let thresholdBuff = thresholdPrestige + (isEpic ? 0.40 : 0.23);

  let items = [];
  let winningIndex = 25 + Math.floor(Math.random() * 8); // 25-32 range for visual variety
  let winningItem = null;

  for (let i = 0; i < 35; i++) {
    const r = Math.random();
    let item = {};

    if (r < thresholdGems) {
      item.type = 'gems';
      item.val = Math.floor(Math.random() * 41) + 10;
      item.html = `<div class="roulette-item common"><span>${t('lootbox_roulette_gems')}</span><div style="font-size:3rem; line-height:60px; height:60px;">💎</div><span>${t('lootbox_roulette_gems_count').replace('{val}', item.val)}</span></div>`;
    } else if (r < thresholdGP) {
      item.type = 'gp';
      item.val = Math.max(1000, getEffectiveAutoPower() * 300);
      item.html = `<div class="roulette-item common"><span>${t('lootbox_roulette_mass')}</span><img src="images/GP.webp"><span>${formatNum(item.val)} GP</span></div>`;
    } else if (r < thresholdPrestige) {
      item.type = 'prestige';
      item.val = 1;
      item.html = `<div class="roulette-item legendary"><span>${t('lootbox_roulette_prestige')}</span><img src="images/coin.webp"><span>1 🪙</span></div>`;
    } else if (r < thresholdBuff) {
      item.type = 'buff';
      item.val = 5;
      item.html = `<div class="roulette-item rare"><span>${t('lootbox_roulette_buff')}</span><div style="font-size:3rem; line-height:60px; height:60px;">⚡</div><span>${t('lootbox_roulette_buff_desc')}</span></div>`;
    } else {
      const randomSkin = SKINS[Math.floor(Math.random() * SKINS.length)];
      item.type = 'skin';
      item.val = randomSkin;
      const imgPath = `images/skins/${randomSkin.id}/skin-${currentTier}-${randomSkin.id}.webp`;
      const fallbackFolder = fullTiers[currentTierIdx].folder;
      const fallbackFile = fullTiers[currentTierIdx].file;
      item.html = `<div class="roulette-item epic"><span>${t('lootbox_roulette_skin')}</span><img src="${imgPath}" onerror="this.src='images/${fallbackFolder}/${fallbackFile}'"><span>${randomSkin.name}</span></div>`;
    }
    items.push(item);
    if (i === winningIndex) winningItem = item;
  }

  $tape.innerHTML = items.map(i => i.html).join('');

  // Calculate offset
  $tape.offsetHeight; // force reflow

  const itemWidth = 110;
  const centerOffset = $container.clientWidth / 2;
  const targetPos = (winningIndex * itemWidth) + (itemWidth / 2);

  const randomOffset = (Math.random() * 60) - 30; // -30 to +30 px

  const finalTranslateX = - (targetPos - centerOffset + randomOffset);

  $tape.style.transition = 'transform 5s cubic-bezier(0.1, 0.8, 0.1, 1)';
  $tape.style.transform = `translateX(${finalTranslateX}px)`;

  beep(150, 0.1); setTimeout(() => beep(200, 0.1), 200); setTimeout(() => beep(250, 0.1), 400);

  // Play tick sounds
  const tick1 = setInterval(() => beep(900, 0.05), 150);
  setTimeout(() => {
    clearInterval(tick1);
    const tick2 = setInterval(() => beep(900, 0.05), 300);
    setTimeout(() => {
      clearInterval(tick2);
      const tick3 = setInterval(() => beep(900, 0.05), 500);
      setTimeout(() => clearInterval(tick3), 1000);
    }, 1500);
  }, 2500);

  setTimeout(() => {
    if (winningItem.type === 'gems') {
      let finalVal = winningItem.val * multiplier;
      state.gems += finalVal;
      $res.innerHTML = t('lootbox_res_gems').replace('{val}', finalVal);
      beep(600, 0.1); setTimeout(() => beep(800, 0.2), 100);
    } else if (winningItem.type === 'gp') {
      let finalVal = winningItem.val * multiplier;
      state.gpCount += finalVal;
      state.totalGPEarned = (state.totalGPEarned || 0) + finalVal;
      state.runGPEarned = (state.runGPEarned || 0) + finalVal;
      $res.innerHTML = t('lootbox_res_gp').replace('{val}', formatNum(finalVal));
      beep(600, 0.1);
    } else if (winningItem.type === 'prestige') {
      let finalVal = winningItem.val * multiplier;
      state.prestigeCoins = (state.prestigeCoins || 0) + finalVal;
      $res.innerHTML = t('lootbox_res_prestige').replace('{val}', finalVal);
      beep(800, 0.2); setTimeout(() => beep(1000, 0.3), 200);
      spawnConfetti(); spawnConfetti();
    } else if (winningItem.type === 'buff') {
      state.lootboxBuffMultiplier = 5 * multiplier;
      state.lootboxBuffUntil = Date.now() + 5 * 60000;
      $res.innerHTML = t('lootbox_res_buff').replace('{val}', 5 * multiplier);
      beep(500, 0.3);
    } else if (winningItem.type === 'skin') {
      const s = winningItem.val;
      if (!state.skins) state.skins = [];
      let comp = 0;
      if (multiplier > 1) {
          // Extra copies turn into gems
          comp = (multiplier - 1) * 25;
          state.gems += comp;
      }
      
      if (state.skins.includes(s.id)) {
        state.gems += 25; // Original also turns into gems
        $res.innerHTML = t('lootbox_res_skin_dup').replace('{skin}', s.name).replace('{comp}', 25 + comp);
        beep(700, 0.2);
      } else {
        state.skins.push(s.id);
        $res.innerHTML = t('lootbox_res_skin_new').replace('{skin}', s.name).replace('{comp_text}', comp > 0 ? `+ ${comp} 💎` : '');
        spawnConfetti(); spawnConfetti();
        beep(800, 0.2); setTimeout(() => beep(1000, 0.3), 200);
      }
    }

    saveGame();
    translateUI();
    updateUI();
    $btn.disabled = false;
    $adBtn.disabled = false;
    $btn.textContent = t('lootbox_spin_more');

    const adsWatched = state.lootboxAdsWatched || 0;
    if (adsWatched >= 3) {
      $adBtn.style.display = 'none';
    } else {
      document.getElementById('lootbox-ad-count').textContent = (3 - adsWatched);
    }
  }, 5200);
}

document.getElementById('open-lootbox-btn')?.addEventListener('click', () => {
  if (state.gems < 25) {
    showToast(t('toast_not_enough_gems'));
    beep(200, 0.3);
    return;
  }
  state.gems -= 25;
  saveGame();
  translateUI();
  updateUI();
  processLootbox();
});

document.getElementById('open-lootbox-ad-btn')?.addEventListener('click', () => {
  confirmAd(t('ad_lootbox_desc'), () => {
    if (ysdk && ysdk.adv) {
      let rewarded = false;
      ysdk.adv.showRewardedVideo({
        callbacks: {
          onOpen: () => { onAdOpen(); },
          onRewarded: () => { rewarded = true; },
          onClose: () => {
            onAdClose();
            if (rewarded) {
              state.lootboxAdsWatched = (state.lootboxAdsWatched || 0) + 1;
              saveGame();
              processLootbox();
            }
          },
          onError: (e) => { onAdClose(); console.error(e); showToast(t('toast_ad_error')); }
        }
      });
    } else {
      showToast(t('toast_ad_unavailable'));
    }
  });
});

/* ═══════════════════════════════════════════════════════
   DAILY LOGIN LOGIC
   ═══════════════════════════════════════════════════════ */
const DAILY_REWARDS = [
  { day: 1, icon: '<img src="images/GP.webp" style="width:1.2em; vertical-align:middle;">', get title() { return '1,000 GP'; }, action: () => { state.gpCount += 1000; } },
  { day: 2, icon: '💎', get title() { return '5 ' + t('bp_reward_gems'); }, action: () => { state.gems += 5; } },
  { day: 3, icon: '<img src="images/GP.webp" style="width:1.2em; vertical-align:middle;">', get title() { return '10,000 GP'; }, action: () => { state.gpCount += 10000; } },
  { day: 4, icon: '💎', get title() { return '15 ' + t('bp_reward_gems'); }, action: () => { state.gems += 15; } },
  { day: 5, icon: '🎒', get title() { return t('bp_reward_lootbox_1'); }, action: () => { state.gems += 25; document.getElementById('lootbox-btn').click(); } },
  { day: 6, icon: '⚡', get title() { return t('bp_reward_buff_x5'); }, action: () => { state.lootboxBuffMultiplier = 5; state.lootboxBuffUntil = Date.now() + 10 * 60000; } },
  {
    day: 7, icon: '🤖', get title() { return t('bp_reward_skin').replace('{skin}', t('skin_kiborg_name')); }, action: () => {
      if (!state.skins) state.skins = [];
      if (state.skins.includes('kiborg')) { state.gems += 100; showToast(t('toast_daily_7_dup')); }
      else { state.skins.push('kiborg'); showToast(t('toast_daily_7_new')); }
    }
  },
];

function renderDailyRewards() {
  const $grid = document.getElementById('daily-grid');
  $grid.innerHTML = '';

  let activeDay = state.loginStreak % 7;
  if (state.dailyRewardClaimed) {
    activeDay = (state.loginStreak - 1 + 7) % 7;
  }

  DAILY_REWARDS.forEach((rew, idx) => {
    const isClaimed = idx < activeDay || (idx === activeDay && state.dailyRewardClaimed);
    const isCurrent = idx === activeDay && !state.dailyRewardClaimed;

    let cls = 'daily-card';
    if (idx === 6) cls += ' day7';
    if (isClaimed) cls += ' claimed';
    if (isCurrent) cls += ' current';

    $grid.innerHTML += `
      <div class="${cls}">
        <div class="daily-day">${t('daily_day')} ${rew.day}</div>
        <div class="daily-icon">${rew.icon}</div>
        <div class="daily-reward-text">${t('daily_' + rew.day + '_title') || rew.title}</div>
      </div>
    `;
  });

  const $btn = document.getElementById('daily-claim-btn');
  if (state.dailyRewardClaimed) {
    $btn.disabled = true;
    $btn.textContent = t('daily_already_claimed');
  } else {
    $btn.disabled = false;
    $btn.textContent = t('btn_claim');
  }
}

document.getElementById('daily-btn')?.addEventListener('click', () => {
  renderDailyRewards();
  document.getElementById('daily-overlay').style.display = 'flex';
});
document.getElementById('close-daily')?.addEventListener('click', () => {
  document.getElementById('daily-overlay').style.display = 'none';
});

document.getElementById('daily-claim-btn')?.addEventListener('click', () => {
  if (state.dailyRewardClaimed) return;

  const currentStreak = state.loginStreak % 7;
  const reward = DAILY_REWARDS[currentStreak];

  reward.action();
  state.dailyRewardClaimed = true;
  state.loginStreak++;

  saveGame();
  translateUI();
  updateUI();
  renderDailyRewards();

  spawnConfetti();
  beep(500, 0.1); setTimeout(() => beep(700, 0.2), 150); setTimeout(() => beep(900, 0.3), 300);
});

// Auto-open daily if not claimed, but only once per session
function checkDailyAutoOpen() {
  if (state.tutorialStep !== undefined && state.tutorialStep < 99) return;

  if (!state.dailyRewardClaimed && !sessionStorage.getItem('dailyShown')) {
    sessionStorage.setItem('dailyShown', 'true');
    setTimeout(() => {
      document.getElementById('daily-btn')?.click();
    }, 1500);
  }
}



/* ─── Initial render ──────────────────────────────────── */
try {
  loadGame();
  initYandexSDK();
  setInterval(saveGame, 10000); // Save every 10s to not spam Yandex API
  window.addEventListener('beforeunload', saveGame);
  translateUI();
  updateUI();
  updateTutorial();
} catch (e) {
  alert("Error: " + e.message + "\nStack: " + e.stack);
}
/* ═══════════════════════════════════════════════════════
   MODERATION REQUIREMENTS
   ═══════════════════════════════════════════════════════ */
// 1. Disable context menu to prevent text selection and right clicks
document.addEventListener('contextmenu', e => e.preventDefault());

// 2. Pause audio on visibility loss (tab switch, minimize)
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (musicIsPlaying) {
      pauseBgMusic();
      window._bgMusicWasPlaying = true;
    }
  } else {
    if (window._bgMusicWasPlaying && state.musicVolume > 0 && !window.isAdPlaying) {
      playBgMusic();
      window._bgMusicWasPlaying = false;
    }
  }
});
