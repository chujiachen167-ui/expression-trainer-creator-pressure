var ReadYourselfBloubCore = (function(exports) {
	Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
	//#region src/bot/math.ts
	var TAU = Math.PI * 2;
	var clamp = (v, lo = 0, hi = 1) => v < lo ? lo : v > hi ? hi : v;
	var lerp = (a, b, t) => a + (b - a) * t;
	/**
	* Mesure sur la video : les transitions sont des ease-out exponentiels, sans
	* depassement du corps. Les seuls effets de ressort sont locaux (le pop de la
	* pastille de notification, l'ouverture des yeux) et sont ecrits directement
	* dans l'etat concerne.
	*/
	var easings = {
		easeOutCubic: (t) => 1 - (1 - t) ** 3,
		easeInOutCubic: (t) => t < .5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2,
		easeOutQuint: (t) => 1 - (1 - t) ** 5
	};
	/** Bruit 1D periodique : boucle sans couture sur `period`, utile pour la derive du regard. */
	function loopNoise(t, period, seed = 0) {
		const p = t / period * TAU;
		return .55 * Math.sin(p + seed) + .3 * Math.sin(2 * p + seed * 1.7 + 1.1) + .15 * Math.sin(3 * p + seed * 2.3 + 2.4);
	}
	/** PRNG deterministe (mulberry32) : meme sequence a chaque lecture. */
	function createRng(seed) {
		let a = seed >>> 0;
		return () => {
			a = a + 1831565813 >>> 0;
			let t = Math.imul(a ^ a >>> 15, 1 | a);
			t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
			return ((t ^ t >>> 14) >>> 0) / 4294967296;
		};
	}
	/** Arrondi court : divise par ~2 le poids des chaines de path generees a 60 fps. */
	var r2 = (v) => Math.round(v * 100) / 100;
	//#endregion
	//#region src/bot/decor.ts
	/**
	* Les anneaux ne sont pas des couleurs plates : la video montre une roue de
	* teintes complete a luminosite constante, avec un degrade le long de chaque
	* trace. Mesure : S 45-62 %, L 50-67 %.
	*/
	function wheel(hue, s = .55, l = .62) {
		const h = (hue % 360 + 360) % 360;
		const c = (1 - Math.abs(2 * l - 1)) * s;
		const x = c * (1 - Math.abs(h / 60 % 2 - 1));
		const m = l - c / 2;
		const [r, g, b] = h < 60 ? [
			c,
			x,
			0
		] : h < 120 ? [
			x,
			c,
			0
		] : h < 180 ? [
			0,
			c,
			x
		] : h < 240 ? [
			0,
			x,
			c
		] : h < 300 ? [
			x,
			0,
			c
		] : [
			c,
			0,
			x
		];
		const hex = (v) => Math.round((v + m) * 255).toString(16).padStart(2, "0");
		return `#${hex(r)}${hex(g)}${hex(b)}`;
	}
	/**
	* Projette un cercle 3D incline en orthographique.
	*
	* Le cercle vit dans le plan engendre par u (dans l'ecran) et v (qui plonge
	* dans la profondeur). La composante z sert a couper l'arc en deux : la moitie
	* arriere est dessinee avant le corps, donc occultee par lui. C'est ce vrai tri
	* en profondeur qui fait lire les anneaux comme des orbites et pas comme un
	* dessin plat.
	*/
	function arcRender(seed, t, scale, id, opacity = 1) {
		const spin = seed.phase + t * seed.speed * TAU;
		const cu = Math.cos(seed.tilt);
		const su = Math.sin(seed.tilt);
		const kz = Math.sqrt(Math.max(0, 1 - seed.k * seed.k));
		const N = 64;
		const span = seed.sweep * TAU;
		let front = "";
		let back = "";
		let prev = null;
		for (let i = 0; i <= N; i++) {
			const th = spin + i / N * span;
			const ct = Math.cos(th);
			const st = Math.sin(th);
			const x = seed.a * (ct * cu + st * -su * seed.k) + seed.cx;
			const y = seed.a * (ct * su + st * cu * seed.k) + seed.cy;
			const behind = seed.a * st * kz < 0;
			const sx = r2(x * scale);
			const sy = r2(y * scale);
			const cmd = behind !== prev ? "M" : "L";
			if (behind) back += `${cmd}${sx} ${sy}`;
			else front += `${cmd}${sx} ${sy}`;
			prev = behind;
		}
		const gx = Math.cos(seed.tilt) * seed.a * scale;
		const gy = Math.sin(seed.tilt) * seed.a * scale;
		return {
			id,
			front,
			back,
			width: seed.width * scale,
			opacity,
			grad: {
				x1: r2(seed.cx * scale - gx),
				y1: r2(seed.cy * scale - gy),
				x2: r2(seed.cx * scale + gx),
				y2: r2(seed.cy * scale + gy),
				stops: [
					wheel(seed.hue),
					wheel(seed.hue + seed.hueSpan * .5),
					wheel(seed.hue + seed.hueSpan)
				]
			}
		};
	}
	var RING_RNG = createRng(659918);
	/**
	* 6 anneaux, demi-grand axe 1.30-1.40 (donc nettement plus grands que la
	* boule), aplatissement toujours <= 0.45, epaisseur 0.055, ~3.3 tours/s.
	*/
	var RINGS = Array.from({ length: 6 }, (_, i) => ({
		a: 1.3 + RING_RNG() * .1,
		k: .05 + RING_RNG() * .4,
		tilt: i / 6 * Math.PI + RING_RNG() * .5,
		speed: 3 + RING_RNG() * .7,
		phase: RING_RNG() * TAU,
		sweep: .6 + RING_RNG() * .25,
		hue: i * 360 / 6 + RING_RNG() * 30,
		hueSpan: 60 + RING_RNG() * 60,
		width: .05 + RING_RNG() * .012,
		cx: 0,
		cy: .1
	}));
	/**
	* Bouquet d'arcs emboites qui balaie le triangle juste avant les orbites.
	* Vus quasiment par la tranche (d'ou la forme en epingle a cheveux), rmax 1.37.
	*/
	var SWOOSH = Array.from({ length: 4 }, (_, i) => ({
		a: .78 + i * .2,
		k: .05 + i * .02,
		tilt: -.62 + i * .05,
		speed: .3,
		phase: .06 * i,
		sweep: .4,
		hue: 95 + i * 62,
		hueSpan: 100,
		width: .05,
		cx: 0,
		cy: -.12
	}));
	/** x mesures : -0.557 / -0.013 / +0.532, y = 0. */
	var DOT_X = [
		-.557,
		-.013,
		.532
	];
	var DOT_R = .165;
	var DOT_PEAK = 1.25;
	var P_RNG = createRng(48879);
	/** 5 particules, une nouvelle toutes les 0.2 s, duree de vie 0.55 s. */
	var PARTICLES = Array.from({ length: 5 }, (_, i) => ({
		birth: i * .2,
		angle: P_RNG() * TAU,
		rho: .58 + P_RNG() * .18
	}));
	/**
	* Les particules ne partent pas en ligne droite : elles spiralent vers le
	* centre (rayon x0.75 par frame, angle +100 deg/s) en grossissant, et passent
	* derriere le noyau ou elles sont avalees.
	*/
	function particles(t, scale) {
		const out = [];
		for (const p of PARTICLES) {
			const u = t - p.birth;
			if (u < 0 || u > .62) continue;
			const rho = p.rho * Math.pow(.75, u * 10);
			const a = p.angle + u * 100 * Math.PI / 180;
			out.push({
				x: Math.cos(a) * rho * scale,
				y: Math.sin(a) * rho * scale,
				r: (.04 + .028 * clamp(u / .55)) * scale,
				depth: clamp(1 - rho / .8),
				opacity: clamp(u / .06) * clamp((.62 - u) / .08)
			});
		}
		return out;
	}
	/**
	* Contrairement a l'intuition, le point ne traverse pas l'ecran : il reste au
	* centre et c'est la trainee qui l'orbite. Ellipse a = 0.85, b = 0.15,
	* grand axe incline de +34deg, 4 rubans, ~210 deg/s.
	*/
	var COMET_RNG = createRng(49383);
	var COMET_RIBBONS = Array.from({ length: 4 }, (_, i) => {
		const d = i - 1.5;
		return {
			a: .85 * (1 + d * .03),
			k: .15 / .85 * (1 + d * .16),
			tilt: 34 * Math.PI / 180 + d * .035,
			speed: 210 / 360,
			phase: -i * .045 + COMET_RNG() * .012,
			sweep: .34,
			hue: i * 85 + COMET_RNG() * 20,
			hueSpan: 80,
			width: .095,
			cx: 0,
			cy: 0
		};
	});
	/** Rayon du point de la comete, mesure a 0.129. */
	var COMET_DOT = .129;
	var NOTIF_DIST = 1.003;
	/** Rayon au repos ; le pop culmine 14 % au-dessus. */
	var NOTIF_R = .15;
	var NOTIF_POP = 1.14;
	/**
	* L'encoche est un disque concentrique a la pastille, soustrait du corps.
	* La marge est constante (0.054 R) et suit l'echelle du corps.
	*/
	var NOTIF_MARGIN = .054;
	//#endregion
	//#region src/bot/face.ts
	/** Demi-ecart des yeux sur la sphere, en degres (separation totale ~31deg). */
	var EYE_SPLIT = 15.46;
	/** Taille de l'oeil au repos, en unites de rayon de boule. */
	var EYE_W = .186;
	var EYE_H = .412;
	/** Orientation de tete au repos, ajustee sur les frames de reference. */
	var REST_GAZE = {
		yaw: 28.49,
		pitch: 28.62,
		roll: -13
	};
	var deg = (d) => d * Math.PI / 180;
	/** Fait tourner deux vecteurs d'un repere orthonorme dans leur plan commun. */
	function spin(u, v, angle) {
		const c = Math.cos(angle);
		const s = Math.sin(angle);
		return [[
			u[0] * c + v[0] * s,
			u[1] * c + v[1] * s,
			u[2] * c + v[2] * s
		], [
			v[0] * c - u[0] * s,
			v[1] * c - u[1] * s,
			v[2] * c - u[2] * s
		]];
	}
	/**
	* Repere de la tete puis des deux yeux.
	* Repere ecran : x a droite, y vers le bas, z vers le spectateur.
	* L'indice 0 est l'oeil interieur, l'indice 1 l'oeil exterieur.
	*/
	function eyePoses(gaze, scale, split = EYE_SPLIT) {
		let f = [
			0,
			0,
			1
		];
		let right = [
			1,
			0,
			0
		];
		let down = [
			0,
			1,
			0
		];
		[f, right] = spin(f, right, deg(gaze.yaw));
		[down, f] = spin(down, f, deg(gaze.pitch));
		[right, down] = spin(right, down, deg(gaze.roll));
		const build = (side) => {
			const [ef, er] = spin(f, right, deg(split * side));
			return {
				x: ef[0] * scale,
				y: ef[1] * scale,
				a: er[0],
				b: er[1],
				c: down[0],
				d: down[1],
				depth: ef[2]
			};
		};
		return [build(-1), build(1)];
	}
	var BLINK_RNG = createRng(24301);
	/** Calendrier de clignements pre-tire : deterministe et sans etat. */
	var BLINKS = (() => {
		const out = [];
		let t = 1.4;
		while (t < 900) {
			out.push(t);
			t += 1.9 + BLINK_RNG() * 2.7;
			if (BLINK_RNG() < .18) {
				out.push(t);
				t += .24;
			}
		}
		return out;
	})();
	/** Mesure : 1 a 2 frames a 10 fps. */
	var BLINK_DUR = .18;
	function blinkLid(t) {
		for (let i = 0; i < BLINKS.length; i++) {
			const start = BLINKS[i];
			if (t < start) break;
			const k = (t - start) / BLINK_DUR;
			if (k >= 0 && k <= 1) return k < .45 ? 1 - k / .45 : (k - .45) / .55;
		}
		return 1;
	}
	function liveliness(t, opt = {}) {
		const { wander = 1, blink = true, float = true } = opt;
		return {
			dYaw: (loopNoise(t, 11.3, .4) * 5.5 + loopNoise(t, 3.7, 2.1) * 1.6) * wander,
			dPitch: (loopNoise(t, 9.1, 1.3) * 4.2 + loopNoise(t, 4.3, .7) * 1.3) * wander,
			dRoll: loopNoise(t, 13.7, 3.2) * 2.2 * wander,
			lid: blink ? blinkLid(t) : 1,
			driftX: float ? loopNoise(t, 7.9, 1.9) * .006 : 0,
			driftY: float ? loopNoise(t, 5.3, .3) * .007 : 0,
			breath: float ? 1 + Math.sin(t / 3.4 * Math.PI * 2) * .005 : 1
		};
	}
	/**
	* Le clignement est un ecrasement VERTICAL en repere ecran autour du centre de
	* l'oeil (mesure : la largeur de bbox est conservee, la hauteur tombe a ~0.35),
	* pas un retrecissement le long de l'axe incline de la gelule. On le compose
	* donc apres la matrice tangente, en n'affectant que les sorties en y.
	*/
	function blinkScale(lid) {
		return .06 + .94 * clamp(lid);
	}
	//#endregion
	//#region src/bot/expressions.ts
	/** `tilt` en degrés, positif = le haut de la gélule part vers la droite. */
	var eye = (w, h, tilt = 0, open = 1) => ({
		w,
		h,
		tilt,
		open
	});
	/** Les deux yeux identiques, inclinaisons en miroir si `tilt` est fourni. */
	var pair$1 = (w, h, tilt = 0, open = 1) => [eye(w, h, tilt, open), eye(w, h, -tilt, open)];
	var EXPRESSIONS = [
		{
			id: "neutre",
			gaze: { ...REST_GAZE },
			split: EYE_SPLIT,
			eyes: [eye(EYE_W, EYE_H), eye(EYE_W, EYE_H)]
		},
		{
			id: "attentif",
			gaze: {
				yaw: 4,
				pitch: 5,
				roll: -4
			},
			split: 16,
			eyes: pair$1(.21, .44)
		},
		{
			id: "surpris",
			gaze: {
				yaw: 3,
				pitch: -3,
				roll: 0
			},
			split: 19,
			eyes: pair$1(.45, .47)
		},
		{
			id: "excite",
			gaze: {
				yaw: 6,
				pitch: -14,
				roll: 0
			},
			split: 19.5,
			eyes: pair$1(.4, .56, -10)
		},
		{
			id: "heureux",
			gaze: {
				yaw: 5,
				pitch: 9,
				roll: 0
			},
			split: 17,
			eyes: pair$1(.27, .17, 14)
		},
		{
			id: "hilare",
			gaze: {
				yaw: 4,
				pitch: 14,
				roll: 0
			},
			split: 18,
			eyes: pair$1(.34, .13, 20)
		},
		{
			id: "colere",
			gaze: {
				yaw: 3,
				pitch: 7,
				roll: 0
			},
			split: 17,
			eyes: pair$1(.34, .15, 30)
		},
		{
			id: "triste",
			gaze: {
				yaw: 3,
				pitch: -13,
				roll: 0
			},
			split: 16,
			eyes: pair$1(.22, .4, -28)
		},
		{
			id: "effraye",
			gaze: {
				yaw: 2,
				pitch: -20,
				roll: 0
			},
			split: 20.5,
			eyes: pair$1(.4, .6)
		},
		{
			id: "mefiant",
			gaze: {
				yaw: 12,
				pitch: 6,
				roll: -6
			},
			split: 16,
			eyes: [eye(.21, .4), eye(.22, .15)]
		},
		{
			id: "confus",
			gaze: {
				yaw: -14,
				pitch: 3,
				roll: 8
			},
			split: 16.5,
			eyes: [eye(.2, .44, -18), eye(.28, .17, 14)]
		},
		{
			id: "curieux",
			gaze: {
				yaw: 16,
				pitch: -9,
				roll: -15
			},
			split: 16.5,
			eyes: [eye(.24, .46, -8), eye(.2, .38, -8)]
		},
		{
			id: "fier",
			gaze: {
				yaw: 5,
				pitch: 17,
				roll: 0
			},
			split: 17,
			eyes: pair$1(.3, .15, 18)
		},
		{
			id: "timide",
			gaze: {
				yaw: -19,
				pitch: -14,
				roll: -7
			},
			split: 14,
			eyes: pair$1(.17, .3)
		},
		{
			id: "blase",
			gaze: {
				yaw: -22,
				pitch: 2,
				roll: 0
			},
			split: 16,
			eyes: pair$1(.3, .12)
		},
		{
			id: "somnolent",
			gaze: {
				yaw: 6,
				pitch: -9,
				roll: -3
			},
			split: 16,
			eyes: pair$1(.2, .42, 0, .42)
		}
	];
	var EXPRESSION_BY_ID = new Map(EXPRESSIONS.map((e) => [e.id, e]));
	var lerpEyeCfg = (a, b, t) => ({
		w: lerp(a.w, b.w, t),
		h: lerp(a.h, b.h, t),
		tilt: lerp(a.tilt ?? 0, b.tilt ?? 0, t),
		open: lerp(a.open, b.open, t)
	});
	/** Interpolation de deux expressions : le changement se fait en glissant. */
	function blendExpression(a, b, t) {
		return {
			id: b.id,
			gaze: {
				yaw: lerp(a.gaze.yaw, b.gaze.yaw, t),
				pitch: lerp(a.gaze.pitch, b.gaze.pitch, t),
				roll: lerp(a.gaze.roll, b.gaze.roll, t)
			},
			split: lerp(a.split, b.split, t),
			eyes: [lerpEyeCfg(a.eyes[0], b.eyes[0], t), lerpEyeCfg(a.eyes[1], b.eyes[1], t)]
		};
	}
	//#endregion
	//#region src/bot/profiles.ts
	var PROFILES = {
		egg: [
			.8369,
			.8424,
			.8497,
			.8585,
			.8674,
			.8775,
			.8878,
			.8983,
			.9089,
			.9185,
			.9288,
			.9374,
			.9445,
			.9504,
			.9543,
			.9559,
			.9555,
			.9519,
			.9466,
			.9389,
			.9302,
			.9193,
			.9085,
			.8969,
			.8852,
			.8734,
			.8625,
			.8513,
			.8411,
			.8325,
			.8243,
			.8179,
			.8137,
			.8112,
			.8102,
			.8128,
			.8178,
			.8262,
			.8374,
			.8518,
			.8702,
			.8922,
			.9169,
			.9446,
			.9741,
			1.0023,
			1.0267,
			1.0433,
			1.0481,
			1.0393,
			1.0216,
			.997,
			.9697,
			.9418,
			.9169,
			.8949,
			.876,
			.8604,
			.849,
			.8394,
			.8337,
			.8314,
			.8305,
			.8326
		],
		hexagon: [
			.921,
			.9282,
			.9441,
			.9706,
			.9984,
			1.0059,
			.9896,
			.9562,
			.929,
			.9124,
			.9047,
			.9058,
			.9157,
			.9349,
			.9642,
			.9873,
			.9882,
			.9665,
			.9336,
			.9105,
			.8968,
			.8918,
			.8955,
			.908,
			.9293,
			.9611,
			.982,
			.9812,
			.959,
			.9282,
			.9089,
			.8978,
			.8964,
			.9026,
			.9189,
			.9439,
			.9778,
			.999,
			.9964,
			.9713,
			.9439,
			.9274,
			.9196,
			.9206,
			.9308,
			.9502,
			.9799,
			1.0121,
			1.0226,
			1.0071,
			.9752,
			.951,
			.9366,
			.9316,
			.9351,
			.9485,
			.9711,
			1.0026,
			1.0213,
			1.0155,
			.9863,
			.9547,
			.9347,
			.9232
		],
		triangle: [
			.7819,
			.8211,
			.8747,
			.944,
			1.0223,
			1.096,
			1.1401,
			1.134,
			1.0808,
			1.0047,
			.9265,
			.8603,
			.8104,
			.773,
			.745,
			.7273,
			.7151,
			.7118,
			.7148,
			.7245,
			.7427,
			.768,
			.8037,
			.8518,
			.9148,
			.9876,
			1.0583,
			1.1073,
			1.1109,
			1.0667,
			.994,
			.9164,
			.8482,
			.7948,
			.7555,
			.7261,
			.7056,
			.6925,
			.6859,
			.6869,
			.6938,
			.7084,
			.7305,
			.7615,
			.804,
			.8595,
			.9311,
			1.0092,
			1.0791,
			1.1171,
			1.1054,
			1.0501,
			.9779,
			.905,
			.845,
			.799,
			.7656,
			.7413,
			.7258,
			.716,
			.7146,
			.7204,
			.733,
			.7528
		]
	};
	//#endregion
	//#region src/bot/shape.ts
	var ANGLES = Array.from({ length: 64 }, (_, i) => i / 64 * TAU);
	var COS = ANGLES.map(Math.cos);
	var SIN = ANGLES.map(Math.sin);
	function silhouette(name, pose = {}) {
		return {
			radii: [...PROFILES[name]],
			rot: 0,
			cx: 0,
			cy: 0,
			sx: 1,
			sy: 1,
			...pose
		};
	}
	/** Cercle parfait : sert de base neutre (point, bulle, cible de fondu). */
	function circle(radius, pose = {}) {
		return {
			radii: new Array(64).fill(radius),
			rot: 0,
			cx: 0,
			cy: 0,
			sx: 1,
			sy: 1,
			...pose
		};
	}
	/** Interpolation de deux silhouettes. `out` est reutilise pour eviter d'allouer a 60 fps. */
	function blend(a, b, t, out) {
		const dst = out ?? {
			radii: new Array(64),
			rot: 0,
			cx: 0,
			cy: 0,
			sx: 1,
			sy: 1
		};
		for (let i = 0; i < 64; i++) dst.radii[i] = lerp(a.radii[i] ?? 1, b.radii[i] ?? 1, t);
		let dRot = b.rot - a.rot;
		while (dRot > Math.PI) dRot -= TAU;
		while (dRot < -Math.PI) dRot += TAU;
		dst.rot = a.rot + dRot * t;
		dst.cx = lerp(a.cx, b.cx, t);
		dst.cy = lerp(a.cy, b.cy, t);
		dst.sx = lerp(a.sx, b.sx, t);
		dst.sy = lerp(a.sy, b.sy, t);
		return dst;
	}
	/** Projette la silhouette en points ecran. `scale` = rayon de la boule en unites de viewBox. */
	function toPoints(s, scale, out = []) {
		const cr = Math.cos(s.rot);
		const sr = Math.sin(s.rot);
		for (let i = 0; i < 64; i++) {
			const r = s.radii[i] ?? 1;
			const x = r * (COS[i] ?? 0);
			const y = r * (SIN[i] ?? 0);
			const rx = x * cr - y * sr;
			const ry = x * sr + y * cr;
			const p = out[i] ?? {
				x: 0,
				y: 0
			};
			p.x = (rx * s.sx + s.cx) * scale;
			p.y = (ry * s.sy + s.cy) * scale;
			out[i] = p;
		}
		out.length = 64;
		return out;
	}
	/**
	* Polyligne fermee -> cubiques Catmull-Rom.
	*
	* Avec 64 points les tangentes centrees suffisent largement : le contour est
	* lisse au pixel pres meme affiche en 600 px, et la chaine reste courte.
	*/
	function closedPath(pts, tension = 1 / 6) {
		const n = pts.length;
		if (n < 3) return "";
		const first = pts[0];
		let d = `M${r2(first.x)} ${r2(first.y)}`;
		for (let i = 0; i < n; i++) {
			const p0 = pts[(i - 1 + n) % n];
			const p1 = pts[i];
			const p2 = pts[(i + 1) % n];
			const p3 = pts[(i + 2) % n];
			const c1x = p1.x + (p2.x - p0.x) * tension;
			const c1y = p1.y + (p2.y - p0.y) * tension;
			const c2x = p2.x - (p3.x - p1.x) * tension;
			const c2y = p2.y - (p3.y - p1.y) * tension;
			d += `C${r2(c1x)} ${r2(c1y)} ${r2(c2x)} ${r2(c2y)} ${r2(p2.x)} ${r2(p2.y)}`;
		}
		return `${d}Z`;
	}
	/**
	* Polygone quelconque -> profil radial, par lancer de rayon depuis `center`.
	*
	* Sert a fabriquer les formes qui ne s'expriment pas naturellement en r(theta)
	* (la barre tronconique du "!"). Calcule une seule fois au chargement, jamais
	* dans la boucle de rendu.
	*/
	function profileFromPolygon(poly, cx, cy) {
		const radii = new Array(64).fill(0);
		const n = poly.length;
		for (let k = 0; k < 64; k++) {
			const dx = COS[k] ?? 0;
			const dy = SIN[k] ?? 0;
			let best = 0;
			for (let i = 0; i < n; i++) {
				const a = poly[i];
				const b = poly[(i + 1) % n];
				const ex = b.x - a.x;
				const ey = b.y - a.y;
				const den = dx * ey - dy * ex;
				if (Math.abs(den) < 1e-9) continue;
				const px = a.x - cx;
				const py = a.y - cy;
				const t = (px * ey - py * ex) / den;
				const u = (px * dy - py * dx) / den;
				if (t > best && u >= 0 && u <= 1) best = t;
			}
			radii[k] = best;
		}
		return radii;
	}
	/** Enveloppe convexe de deux cercles : la barre tronconique du "!" vertical. */
	function hullOfCircles(x1, y1, r1, x2, y2, r2v, steps = 96) {
		const dx = x2 - x1;
		const dy = y2 - y1;
		const dist = Math.hypot(dx, dy) || 1e-6;
		const base = Math.atan2(dy, dx);
		const spread = Math.acos(Math.max(-1, Math.min(1, (r1 - r2v) / dist)));
		const pts = [];
		for (let i = 0; i <= steps / 2; i++) {
			const a = base + spread + (TAU - 2 * spread) * i / (steps / 2);
			pts.push({
				x: x1 + Math.cos(a) * r1,
				y: y1 + Math.sin(a) * r1
			});
		}
		for (let i = 0; i <= steps / 2; i++) {
			const a = base - spread + 2 * spread * i / (steps / 2);
			pts.push({
				x: x2 + Math.cos(a) * r2v,
				y: y2 + Math.sin(a) * r2v
			});
		}
		return pts;
	}
	/**
	* Rayon du profil dans une direction quelconque, par interpolation entre les
	* deux echantillons voisins.
	*
	* Sert a recaler ce qui est pose "sur" le corps (les yeux, la pastille de
	* notification) quand la silhouette n'est plus un cercle : sans ca, un oeil
	* place a 0.62 rayon sort d'une forme dont le bord est a 0.55 dans cette
	* direction, et le masque le rogne.
	*/
	function radiusAtAngle(radii, angle) {
		const n = radii.length;
		const t = (angle / TAU % 1 + 1) % 1 * n;
		const i = Math.floor(t);
		return lerp(radii[i % n] ?? 1, radii[(i + 1) % n] ?? 1, t - i);
	}
	/**
	* Superellipse : |x/sx|^n + |y/sy|^n = 1.
	* n = 2 donne une ellipse, n ~ 4 le squircle du personnalisateur.
	*/
	function superellipseProfile(n, sx = 1, sy = 1) {
		return ANGLES.map((_, i) => {
			return (Math.abs((COS[i] ?? 0) / sx) ** n + Math.abs((SIN[i] ?? 0) / sy) ** n) ** (-1 / n);
		});
	}
	/**
	* Profil radial de l'UNION de disques : r(theta) = la plus lointaine des
	* intersections rayon/cercle. Exact tant que l'origine est dans l'union — c'est
	* ce qui donne les bosses du nuage sans booleen de path.
	*/
	function unionOfCirclesProfile(circles) {
		const out = new Array(64).fill(0);
		for (let i = 0; i < 64; i++) {
			const dx = COS[i] ?? 0;
			const dy = SIN[i] ?? 0;
			let best = 0;
			for (const c of circles) {
				const b = dx * c.x + dy * c.y;
				const disc = b * b - (c.x * c.x + c.y * c.y - c.r * c.r);
				if (disc < 0) continue;
				const t = b + Math.sqrt(disc);
				if (t > best) best = t;
			}
			out[i] = best;
		}
		return out;
	}
	/**
	* Polygone a coins arrondis, par somme de Minkowski avec un disque : chaque
	* arete est poussee de `rc` vers l'exterieur, chaque sommet devient un arc de
	* rayon `rc`. Les sommets sont donc a poser au rayon voulu MOINS rc.
	* Attend un polygone en sens horaire (repere ecran, y vers le bas).
	*/
	function roundedPolygon(verts, rc, arcSteps = 10) {
		const n = verts.length;
		const out = [];
		const normal = (a, b) => {
			const dx = b.x - a.x;
			const dy = b.y - a.y;
			const len = Math.hypot(dx, dy) || 1;
			return Math.atan2(-dx / len, dy / len);
		};
		for (let i = 0; i < n; i++) {
			const prev = verts[(i - 1 + n) % n];
			const cur = verts[i];
			const next = verts[(i + 1) % n];
			const a0 = normal(prev, cur);
			let d = normal(cur, next) - a0;
			while (d > Math.PI) d -= TAU;
			while (d < -Math.PI) d += TAU;
			for (let k = 0; k <= arcSteps; k++) {
				const a = a0 + d * k / arcSteps;
				out.push({
					x: cur.x + Math.cos(a) * rc,
					y: cur.y + Math.sin(a) * rc
				});
			}
		}
		return out;
	}
	/** Polygone regulier a coins arrondis, inscrit dans `radius`. */
	function regularPolygonProfile(sides, radius, rc, rotationDeg = 0) {
		const rot = rotationDeg * Math.PI / 180;
		return profileFromPolygon(roundedPolygon(Array.from({ length: sides }, (_, i) => {
			const a = rot + i / sides * TAU;
			return {
				x: Math.cos(a) * (radius - rc),
				y: Math.sin(a) * (radius - rc)
			};
		}), rc), 0, 0);
	}
	/** Polyligne fermee exacte : garde les segments droits (contrairement a closedPath). */
	function polyPath(pts, scale = 1) {
		if (pts.length < 3) return "";
		let d = "";
		for (let i = 0; i < pts.length; i++) {
			const p = pts[i];
			d += `${i === 0 ? "M" : "L"}${r2(p.x * scale)} ${r2(p.y * scale)}`;
		}
		return `${d}Z`;
	}
	/** Capsule (stade) centree sur l'origine : la forme exacte des yeux du bot. */
	function capsulePath(w, h) {
		const hw = Math.max(w, .01) / 2;
		const hh = Math.max(h, .01) / 2;
		const r = Math.min(hw, hh);
		return `M${r2(-hw)} ${r2(-hh + r)}A${r2(r)} ${r2(r)} 0 0 1 ${r2(-hw + r)} ${r2(-hh)}L${r2(hw - r)} ${r2(-hh)}A${r2(r)} ${r2(r)} 0 0 1 ${r2(hw)} ${r2(-hh + r)}L${r2(hw)} ${r2(hh - r)}A${r2(r)} ${r2(r)} 0 0 1 ${r2(hw - r)} ${r2(hh)}L${r2(-hw + r)} ${r2(hh)}A${r2(r)} ${r2(r)} 0 0 1 ${r2(-hw)} ${r2(hh - r)}Z`;
	}
	//#endregion
	//#region src/bot/skins.ts
	/** Ramene le rayon maximal a `max` pour que toutes les formes pesent pareil a l'oeil. */
	function normalize(radii, max = 1) {
		const peak = Math.max(...radii);
		if (peak <= 0) return radii;
		const k = max / peak;
		return radii.map((r) => r * k);
	}
	/** Galet : cercle deforme par deux harmoniques basses, donc irregulier mais lisse. */
	var pebble = normalize(Array.from({ length: 64 }, (_, i) => i / 64 * Math.PI * 2).map((a) => 1 + .075 * Math.cos(2 * a + .5) + .035 * Math.cos(3 * a + 2.1)), 1.02);
	/** Nuage : union de bosses, large en bas, deux lobes en haut. */
	var cloud = normalize(unionOfCirclesProfile([
		{
			x: -.44,
			y: .2,
			r: .54
		},
		{
			x: .46,
			y: .2,
			r: .5
		},
		{
			x: .02,
			y: .3,
			r: .6
		},
		{
			x: -.24,
			y: -.3,
			r: .48
		},
		{
			x: .3,
			y: -.24,
			r: .44
		}
	]), 1.02);
	/** Goutte : gros disque en bas, pointe effilee en haut. */
	var droplet = normalize(profileFromPolygon(hullOfCircles(0, .28, .66, 0, -.96, .05), 0, 0), 1.04);
	/** Capsule couchee : enveloppe de deux disques cote a cote. */
	var capsule = profileFromPolygon(hullOfCircles(-.42, 0, .62, .42, 0, .62), 0, 0);
	var SHAPES = [
		{
			id: "cercle",
			radii: new Array(64).fill(1)
		},
		{
			id: "galet",
			radii: pebble
		},
		{
			id: "squircle",
			radii: normalize(superellipseProfile(4.2), 1.15)
		},
		{
			id: "capsule",
			radii: capsule
		},
		{
			id: "triangle",
			radii: regularPolygonProfile(3, 1.12, .34, -90)
		},
		{
			id: "hexagone",
			radii: regularPolygonProfile(6, 1.04, .26, 0)
		},
		{
			id: "nuage",
			radii: cloud
		},
		{
			id: "goutte",
			radii: droplet
		}
	];
	new Map(SHAPES.map((s) => [s.id, s]));
	new Map([
		{
			id: "encre",
			hex: "#0a0a0c"
		},
		{
			id: "brun",
			hex: "#8b5e3c"
		},
		{
			id: "rouge",
			hex: "#e8483f"
		},
		{
			id: "orange",
			hex: "#f08a24"
		},
		{
			id: "ambre",
			hex: "#f0b429"
		},
		{
			id: "vert",
			hex: "#3ecf8e"
		},
		{
			id: "turquoise",
			hex: "#2fbfa0"
		},
		{
			id: "bleu",
			hex: "#3b93f0"
		},
		{
			id: "violet",
			hex: "#8b5cf6"
		},
		{
			id: "rose",
			hex: "#e152b0"
		},
		{
			id: "gris",
			hex: "#a3a3a3"
		},
		{
			id: "creme",
			hex: "#f1efe9"
		}
	].map((c) => [c.id, c]));
	//#endregion
	//#region src/bot/states.ts
	var pair = (w, h) => [{
		w,
		h,
		open: 1
	}, {
		w,
		h,
		open: 1
	}];
	function base(over = {}) {
		return {
			sil: circle(1),
			offX: 0,
			offY: 0,
			gaze: { ...REST_GAZE },
			split: EYE_SPLIT,
			eyes: pair(EYE_W, EYE_H),
			eyeAlpha: 1,
			bodyAlpha: 1,
			dots: [],
			arcs: [],
			notif: null,
			dotsBehind: false,
			...over
		};
	}
	/**
	* Barre du "!" vertical : enveloppe convexe de deux cercles.
	* Mesure : cercle haut (0, -0.505) r 0.132, cercle bas (0, +0.130) r 0.075,
	* flancs rectilignes. Elle est donc tronconique (rapport haut/bas 1.76).
	*/
	var BAR_UPRIGHT_CY = -.1875;
	var BAR_UPRIGHT = profileFromPolygon(hullOfCircles(0, -.505, .132, 0, .13, .075), 0, BAR_UPRIGHT_CY);
	/** Barre du "!" penche : capsule pure (largeur constante 0.269, longueur 0.776). */
	var BAR_ITALIC = profileFromPolygon(hullOfCircles(0, -.2535, .1345, 0, .2535, .1345), 0, 0);
	var barUpright = (pose = {}) => ({
		radii: [...BAR_UPRIGHT],
		rot: 0,
		cx: 0,
		cy: BAR_UPRIGHT_CY,
		sx: 1,
		sy: 1,
		...pose
	});
	var barItalic = (pose = {}) => ({
		radii: [...BAR_ITALIC],
		rot: 0,
		cx: 0,
		cy: 0,
		sx: 1,
		sy: 1,
		...pose
	});
	/**
	* Le point du "!" penche n'est pas un disque : c'est une goutte, bout rond
	* (r 0.118) du cote de la barre et pointe effilee a l'oppose, longueur 0.300
	* dans l'axe du glyphe. Centree sur le barycentre du bout rond.
	*/
	var TEAR = polyPath(hullOfCircles(0, 0, .118, 0, .172, .012));
	/**
	* Le triangle ne tourne pas sur lui-meme : son centre decrit un cercle de
	* rayon 0.213 autour de l'origine (mesure). C'est ce decalage qui donne
	* l'impression qu'il bascule au lieu de pivoter sur place.
	*/
	var TRI_ORBIT = .213;
	function spinningTriangle(rot) {
		return silhouette("triangle", {
			rot,
			cx: -.213 * Math.sin(rot),
			cy: TRI_ORBIT * Math.cos(rot)
		});
	}
	/** Onde de pulsation qui parcourt les trois points de gauche a droite. */
	function dotPulse(t, index) {
		const p = ((t - index * .5) / 1.5 % 1 + 1) % 1;
		return clamp((p < .5 ? .5 - .5 * Math.cos(p * TAU) : 0) * 2);
	}
	var STATES = [
		{
			id: "idle",
			duration: 2.4,
			morph: .45,
			blinkIn: false,
			baseFace: true,
			baseBody: true,
			pose: () => base()
		},
		{
			id: "thinking",
			duration: 2.6,
			morph: .4,
			baseFace: false,
			baseBody: false,
			blinkIn: true,
			pose: (t) => {
				const mid = dotPulse(t, 1);
				const emerge = .3 + .7 * easings.easeOutCubic(clamp(t / .3));
				return base({
					sil: circle(DOT_R * (1 + (DOT_PEAK - 1) * mid), { cx: DOT_X[1] }),
					eyeAlpha: 0,
					dots: [0, 2].map((i) => {
						const k = dotPulse(t, i);
						return {
							x: DOT_X[i] * emerge,
							y: 0,
							r: DOT_R * (1 + (DOT_PEAK - 1) * k),
							opacity: .55 + .45 * k
						};
					})
				});
			}
		},
		{
			id: "wink",
			duration: 1.6,
			morph: .3,
			blinkIn: true,
			baseFace: false,
			baseBody: true,
			pose: () => base({
				gaze: {
					yaw: -5.37,
					pitch: 4.55,
					roll: 6.7
				},
				split: 16.25,
				eyes: [{
					w: .236,
					h: .464,
					open: 1
				}, {
					w: .447,
					h: .089,
					open: 1
				}]
			})
		},
		{
			id: "wide",
			duration: 1.8,
			morph: .55,
			blinkIn: true,
			baseFace: false,
			baseBody: true,
			pose: () => base({
				gaze: {
					yaw: 6.92,
					pitch: -21.96,
					roll: 11.6
				},
				split: 18.43,
				eyes: pair(.356, .875)
			})
		},
		{
			id: "alert",
			duration: 2.4,
			minDuration: 2,
			morph: .45,
			baseFace: false,
			baseBody: false,
			blinkIn: false,
			pose: (t) => {
				const p = clamp(t / 1.5);
				const travel = easings.easeInOutCubic(p) * .82 - .087;
				const back = t > 1.6 ? clamp((t - 1.6) / .4) : 0;
				const x = travel * (1 - back) + .1 * back;
				const buzz = Math.sin(t * 2.5 * TAU) * .005;
				const tilt = 17.7 * Math.PI / 180;
				return base({
					sil: barItalic({
						rot: tilt,
						cx: x,
						cy: -.325 - buzz
					}),
					eyeAlpha: 0,
					dots: [{
						x: x - Math.sin(tilt) * .58,
						y: -.325 + Math.cos(tilt) * .58 + buzz * 2.8,
						r: .118,
						d: TEAR,
						rot: tilt * 180 / Math.PI,
						opacity: 1
					}]
				});
			}
		},
		{
			id: "notify",
			duration: 2.2,
			morph: .5,
			blinkIn: true,
			baseFace: false,
			baseBody: true,
			pose: (t) => {
				const p = clamp(t / .45);
				const pop = 1 + (NOTIF_POP - 1) * Math.sin(p * Math.PI) * (1 - p * .35);
				const r = NOTIF_R * (p < 1 ? pop : 1);
				const a = -42 * Math.PI / 180;
				return base({
					gaze: {
						yaw: -21.94,
						pitch: -5.82,
						roll: -12.2
					},
					split: 18.89,
					eyes: pair(.505, .498),
					notif: {
						x: Math.cos(a) * NOTIF_DIST,
						y: Math.sin(a) * NOTIF_DIST,
						r,
						notch: r + NOTIF_MARGIN
					}
				});
			}
		},
		{
			id: "exclaim",
			duration: 2,
			morph: .45,
			baseFace: false,
			baseBody: false,
			blinkIn: false,
			pose: () => base({
				sil: barUpright(),
				eyeAlpha: 0,
				dots: [{
					x: -.012,
					y: .526,
					r: .113,
					opacity: 1
				}]
			})
		},
		{
			id: "sleep",
			duration: 2.4,
			morph: .5,
			baseFace: false,
			baseBody: false,
			blinkIn: false,
			pose: (t) => base({
				sil: circle(.1585, { cy: .11 + Math.sin(t * (TAU / .6)) * .19 }),
				eyeAlpha: 0
			})
		},
		{
			id: "egg",
			duration: 1.8,
			morph: .4,
			baseFace: false,
			baseBody: false,
			blinkIn: true,
			pose: () => base({
				sil: silhouette("egg"),
				gaze: {
					yaw: 19.97,
					pitch: 26.01,
					roll: -17.1
				},
				split: 11.07,
				eyes: pair(.164, .385)
			})
		},
		{
			id: "hexagon",
			duration: 1.6,
			morph: .4,
			baseFace: false,
			baseBody: false,
			blinkIn: true,
			pose: () => base({
				sil: silhouette("hexagon"),
				gaze: {
					yaw: 23.11,
					pitch: 24.42,
					roll: -13.3
				},
				split: 13.37,
				eyes: pair(.177, .411)
			})
		},
		{
			id: "play",
			duration: 2,
			morph: .5,
			baseFace: false,
			baseBody: false,
			blinkIn: true,
			pose: (t) => {
				const fade = clamp(t / .35) * clamp((2.2 - t) / .5);
				return base({
					sil: spinningTriangle(0),
					gaze: {
						yaw: 12,
						pitch: -8,
						roll: -6
					},
					split: 15,
					eyes: pair(.18, .34),
					arcs: SWOOSH.map((s, i) => ({
						id: `sw${i}`,
						seed: {
							...s,
							cx: .45 - t * .42
						},
						t,
						opacity: fade
					}))
				});
			}
		},
		{
			id: "orbit",
			duration: 3.4,
			minDuration: 2.5,
			morph: .6,
			baseFace: false,
			baseBody: false,
			blinkIn: false,
			pose: (t) => {
				const ramp = easings.easeInOutCubic(clamp(t / .35));
				const rot = -TAU * 1.25 * t * ramp;
				const back = easings.easeInOutCubic(clamp((t - 1.6) / .9));
				const tri = spinningTriangle(rot);
				const ball = circle(1, { rot });
				const sil = {
					radii: tri.radii.map((r, i) => r + (ball.radii[i] - r) * back),
					rot,
					cx: tri.cx * (1 - back),
					cy: tri.cy * (1 - back),
					sx: 1,
					sy: 1
				};
				const fade = clamp(t / .8) * clamp((3.6 - t) / .9);
				return base({
					sil,
					gaze: {
						yaw: REST_GAZE.yaw + Math.sin(t * 6.5) * 65 * (1 - back),
						pitch: -4 + back * 32,
						roll: -13
					},
					eyes: pair(.18, .34 + back * .07),
					arcs: RINGS.map((s, i) => ({
						id: `rg${i}`,
						seed: s,
						t,
						opacity: fade * clamp((t - i * .13) / .3)
					}))
				});
			}
		},
		{
			/**
			* Entree dans la vue des reglages.
			*
			* SEUL etat qui n'est pas releve sur la video : il est CHOISI, comme la
			* couleur `--ink`. Il emprunte le vocabulaire d'`orbit` — les memes anneaux,
			* avec leurs parametres mesures — mais coupe court : 1 s au lieu de 3,4, la
			* moitie des anneaux, et aucun triangle.
			*
			* Les deux drapeaux a `true` sont tout l'interet de cet etat :
			*
			* - `baseBody` laisse la forme choisie remplacer le corps, donc la vue peut
			*   imposer le cercle et le galet ou la goutte y MORPHENT au lieu de sauter ;
			* - `baseFace` fait porter le visage de repos, donc le suivi du curseur
			*   s'applique des cette entree. Un etat qui aurait sa propre pose de regard
			*   (comme `orbit`) rendrait la main a l'etat suivant en pleine course, et
			*   les yeux sauteraient d'un coup a la reprise.
			*
			* Il n'est volontairement PAS dans `SEQUENCE` : ce n'est pas une animation du
			* catalogue, c'est une transition d'interface.
			*/
			id: "swirl",
			duration: 1.3,
			minDuration: 1.3,
			morph: .3,
			baseFace: true,
			baseBody: true,
			blinkIn: true,
			pose: (t) => base({ arcs: RINGS.slice(0, 3).map((s, i) => ({
				id: `sw${i}`,
				seed: s,
				t,
				opacity: clamp((t - i * .06) / .14) * clamp((1.22 - t) / .34)
			})) })
		},
		{
			id: "burst",
			duration: 2.6,
			minDuration: 2.4,
			morph: .4,
			baseFace: false,
			baseBody: false,
			blinkIn: false,
			pose: (t) => {
				const collapse = 1 - .834 * easings.easeOutQuint(clamp(t / .7));
				const regrow = easings.easeOutQuint(clamp((t - 1.7) / .7));
				return base({
					sil: circle(collapse + (1 - collapse) * regrow),
					eyeAlpha: clamp((t - 1.85) / .4),
					dots: particles(t, 1),
					dotsBehind: true
				});
			}
		},
		{
			id: "comet",
			duration: 2.4,
			minDuration: 2.4,
			morph: .45,
			baseFace: false,
			baseBody: false,
			blinkIn: false,
			pose: (t) => {
				const collapse = 1 - (1 - COMET_DOT) * easings.easeOutQuint(clamp(t / .55));
				const regrow = easings.easeOutQuint(clamp((t - 1.85) / .6));
				const fade = clamp((t - .15) / .25) * clamp((1.95 - t) / .3);
				return base({
					sil: circle(collapse + (1 - collapse) * regrow, { cy: Math.sin(clamp(t / 1.7) * Math.PI) * .035 }),
					eyeAlpha: clamp((t - 2) / .35),
					arcs: COMET_RIBBONS.map((s, i) => ({
						id: `cm${i}`,
						seed: s,
						t,
						opacity: fade
					}))
				});
			}
		}
	];
	var STATE_BY_ID = new Map(STATES.map((s) => [s.id, s]));
	//#endregion
	//#region src/bot/eyefit.ts
	/**
	* Ou poser le visage sur une forme du personnalisateur.
	*
	* Les yeux vivent sur une sphere, et `radiusAtAngle` les recolle au contour reel au
	* prorata du rayon local. Ce prorata place bien leur CENTRE, mais l'oeil a une taille :
	* la marge qui lui reste devant le bord est multipliee par le meme facteur, donc une
	* silhouette etroite dans sa direction le pousse contre le bord jusqu'a ce que le
	* masque l'ouvre vers l'exterieur. La gelule apparaissait comme une encoche dans le
	* corps sur `capsule`, `triangle`, `nuage` et `goutte`.
	*
	* Ce module resout le probleme UNE FOIS, au chargement, et rend une table de decalages.
	* Ce choix est l'essentiel du correctif, bien plus que la geometrie qui suit :
	*
	* Resolue dans la boucle de rendu, la correction reagit a tout ce qui bouge a soixante
	* images par seconde — la derive du regard, le pointeur, l'expression en cours de
	* morph, le bord le plus proche qui change, l'oeil le plus contraint qui change. Sept
	* variantes ont ete ecrites ainsi et toutes produisaient un artefact de mouvement
	* visible : tremblement permanent, saut de direction de 26 unites quand le bord de
	* reference basculait, grossissement brusque quand la taille entrait dans le calcul.
	* Le defaut n'etait dans aucune de leurs geometries, il etait dans le fait de resoudre
	* par image.
	*
	* Le reste du moteur ne travaille pas comme ca : les poses sont DECLAREES et il ne fait
	* que les interpoler avec des courbes connues. Un decalage tabule rentre dans ce moule.
	* Il ne bouge pas quand le regard derive ni quand le pointeur bouge, et sur un changement
	* de forme ou d'expression il ne fait qu'aller d'une entree de table a l'autre, sur la
	* courbe de ce morph. Le tremblement devient impossible par construction, au lieu d'etre
	* repousse : interpoler entre deux constantes est monotone, alors que re-resoudre le
	* probleme sur un regard en cours d'interpolation ne l'est pas.
	*
	* Corollaire agreable : le solveur n'a plus aucune contrainte de continuite, puisqu'il ne
	* tourne pas pendant l'animation. Il peut donc sonder tout un faisceau de directions et
	* couvrir le pire cas de la derive du regard, ce qu'une version par image ne pouvait pas
	* se permettre.
	*
	* La table est une constante de module, batie a l'import a partir de donnees pures :
	* meme nature que le calendrier de clignements de `face.ts`, deterministe et sans etat,
	* donc sans effet sur la purete de `engine.sample(t)`.
	*/
	/** Rayon de reference du solveur. Le decalage rendu est en unites de ce rayon. */
	var R = 100;
	/**
	* Amplitudes maximales de la vie au repos, lues sur `liveliness` : `loopNoise` est
	* borne a 1 en valeur absolue, donc ces sommes sont des bornes exactes et non des
	* estimations.
	*
	* Il faut les couvrir, sinon la correction est juste sur la pose nominale et fausse une
	* seconde plus tard : 7 degres de lacet deplacent l'oeil d'une douzaine d'unites sur une
	* boule de rayon 100. C'est precisement ce qui faisait deborder `capsule` + `effraye`
	* alors qu'une mesure a un seul instant le declarait bon.
	*/
	var DERIVE_YAW = 7.1;
	var DERIVE_PITCH = 5.5;
	/** Flottement du centre, en unites de rayon de boule. */
	var DERIVE_X = .006;
	var DERIVE_Y = .007;
	/**
	* Empreintes des deux yeux d'un visage, posees sur un profil.
	*
	* Une gelule est exactement un segment epaissi d'un disque de rayon `r`. Son image par
	* la matrice tangente est donc un segment epaissi d'une ELLIPSE, et un disque du rayon
	* de son grand axe la couvre : d'ou la plus grande valeur singuliere. La mesure reste
	* ainsi conservatrice au sens strict, une marge positive garantissant que la gelule est
	* dedans.
	*
	* Le clignement n'y est pas : un oeil ferme n'a pas besoin qu'on lui fasse de la place.
	*/
	function empreintes(visage, sil, radii) {
		const out = [];
		const poses = eyePoses(visage.gaze, R, visage.split);
		for (let i = 0; i < 2; i++) {
			const e = poses[i];
			if (e.depth <= .02) continue;
			const cfg = visage.eyes[i];
			const phi = (cfg.tilt ?? 0) * Math.PI / 180;
			const cp = Math.cos(phi);
			const sp = Math.sin(phi);
			const ax = e.a * cp + e.c * sp;
			const ay = e.b * cp + e.d * sp;
			const cx = -e.a * sp + e.c * cp;
			const cy = -e.b * sp + e.d * cp;
			const hw = Math.max(cfg.w * R, .01) / 2;
			const hh = Math.max(cfg.h * R, .01) / 2;
			const r = Math.min(hw, hh);
			const long = hh > hw;
			const demi = long ? hh - r : hw - r;
			const fit = radiusAtAngle(radii, Math.atan2(e.y, e.x) - sil.rot);
			out.push({
				x: e.x * fit,
				y: e.y * fit,
				ax: (long ? cx : ax) * demi,
				ay: (long ? cy : ay) * demi,
				r,
				m: [
					ax,
					ay,
					cx,
					cy
				]
			});
		}
		return out;
	}
	/**
	* Approche la plus courte entre un contour et un segment : la distance, et le vecteur
	* qui va du contour vers le segment — le sens qui degage.
	*
	* Les deux sortent de la MEME passe. Les calculer separement doublait le seul vrai cout
	* de ce module, qui est ce balayage.
	*/
	function approche(pts, x0, y0, x1, y1) {
		const sx = x1 - x0;
		const sy = y1 - y0;
		const len2 = sx * sx + sy * sy;
		let best = Infinity;
		let vx = 0;
		let vy = 0;
		for (let i = 0; i < pts.length; i++) {
			const p = pts[i];
			let t = len2 > 0 ? ((p.x - x0) * sx + (p.y - y0) * sy) / len2 : 0;
			t = t < 0 ? 0 : t > 1 ? 1 : t;
			const ex = x0 + t * sx - p.x;
			const ey = y0 + t * sy - p.y;
			const d2 = ex * ex + ey * ey;
			if (d2 < best) {
				best = d2;
				vx = ex;
				vy = ey;
			}
		}
		const d = Math.sqrt(best);
		return {
			d,
			ux: d > 1e-9 ? vx / d : 0,
			uy: d > 1e-9 ? vy / d : 0
		};
	}
	/**
	* Flottement du centre au repos, en unites de viewBox. Il est ajoute au rayon de la
	* gelule : moins d'une unite, donc l'absorber ainsi coute moins cher que de multiplier les
	* epreuves par ses quatre coins.
	*/
	var FLOTTEMENT = Math.hypot(DERIVE_X, DERIVE_Y) * R;
	/** Marge de la gelule la plus serree, et le sens qui la degage. */
	function pire(pts, emps, tx, ty) {
		let marge = Infinity;
		let ux = 0;
		let uy = 0;
		for (const e of emps) {
			const x = e.x + tx;
			const y = e.y + ty;
			const a = approche(pts, x - e.ax, y - e.ay, x + e.ax, y + e.ay);
			const [m0, m1, m2, m3] = e.m;
			const rayon = e.r * Math.hypot(m0 * a.ux + m1 * a.uy, m2 * a.ux + m3 * a.uy) + FLOTTEMENT;
			if (a.d - rayon < marge) {
				marge = a.d - rayon;
				ux = a.ux;
				uy = a.uy;
			}
		}
		return {
			marge,
			ux,
			uy
		};
	}
	/**
	* Directions sondees et pas de la dichotomie. Le produit des deux est le cout de
	* construction de la table, seul chiffre a surveiller ici.
	*/
	var DIRECTIONS = 12;
	var DICHOTOMIE = 8;
	/**
	* Le decalage a poser sur les deux yeux pour cette forme, cet etat et cette expression.
	*
	* Une TRANSLATION commune aux deux yeux, donc une isometrie : ecart entre les yeux,
	* tailles et inclinaisons sont conserves au pixel. Le visage est seulement pose un peu
	* plus bas sur un corps qui n'a pas de place en haut, ce qui est le geste qu'on ferait a
	* la main. Les variantes qui bornaient chaque oeil separement ecartaient la paire, et
	* celles qui mettaient le visage a l'echelle rapetissaient les yeux — visiblement.
	*
	* La marge visee est celle du profil D'ORIGINE, pas un degagement strict : sur le cercle
	* l'oeil exterieur frole deja le bord, 17,3 unites pour une boule de rayon 100, et c'est
	* voulu, c'est ce qui donne le volume. Elle est plafonnee par ce que la forme offre en son
	* centre, sinon la demande est intenable sur un corps plat.
	*
	* RECHERCHE DIRECTIONNELLE et non descente. On cherche la translation de plus petite
	* norme qui tient, donc on sonde une couronne de directions et on dichotomie la distance
	* le long de chacune. Une descente de gradient a ete ecrite d'abord et elle ne converge
	* pas : degager la paire d'un bord la rapproche de l'autre, si bien qu'elle tatonne et ne
	* fait que garder son meilleur essai — passer ses tours de 40 a 18 suffisait a faire
	* reapparaitre 34 debordements. Ici le resultat ne depend pas d'une convergence : chaque
	* direction est resolue exactement, au pas de dichotomie pres.
	*/
	function resous(epreuves) {
		if (!epreuves.length) return {
			x: 0,
			y: 0
		};
		/** La marge la plus serree sur toutes les epreuves, pour une translation donnee. */
		const marge = (tx, ty) => {
			let m = Infinity;
			for (const ep of epreuves) m = Math.min(m, pire(ep.contour, ep.empreintes, tx, ty).marge);
			return m;
		};
		let requis = Infinity;
		for (const ep of epreuves) requis = Math.min(requis, pire(ep.calContour, ep.reference, 0, 0).marge);
		let mx = 0;
		let my = 0;
		const emps = epreuves[0].empreintes;
		for (const e of emps) {
			mx -= e.x / emps.length;
			my -= e.y / emps.length;
		}
		const course = Math.max(.35 * R, Math.hypot(mx, my) * 1.25);
		requis = Math.min(requis, marge(mx, my));
		const depart = marge(0, 0);
		if (depart >= requis && depart >= 0) return {
			x: 0,
			y: 0
		};
		const cible = Math.max(requis, 0);
		let meilleurX = 0;
		let meilleurY = 0;
		let meilleureNorme = Infinity;
		let secoursX = 0;
		let secoursY = 0;
		let secours = depart;
		for (let d = 0; d < DIRECTIONS; d++) {
			const a = d / DIRECTIONS * Math.PI * 2;
			const ux = Math.cos(a);
			const uy = Math.sin(a);
			if (marge(ux * course, uy * course) < cible) {
				for (const k of [
					.3,
					.6,
					1
				]) {
					const m = marge(ux * course * k, uy * course * k);
					if (m > secours) {
						secours = m;
						secoursX = ux * course * k;
						secoursY = uy * course * k;
					}
				}
				continue;
			}
			let bas = 0;
			let haut = course;
			for (let i = 0; i < DICHOTOMIE; i++) {
				const mid = (bas + haut) / 2;
				if (marge(ux * mid, uy * mid) >= cible) haut = mid;
				else bas = mid;
			}
			if (haut < meilleureNorme) {
				meilleureNorme = haut;
				meilleurX = ux * haut;
				meilleurY = uy * haut;
			}
		}
		const x = meilleureNorme === Infinity ? secoursX : meilleurX;
		const y = meilleureNorme === Infinity ? secoursY : meilleurY;
		return {
			x: +(x / R).toFixed(6),
			y: +(y / R).toFixed(6)
		};
	}
	/**
	* Le visage a couvrir : celui de l'expression si l'etat l'accepte, le sien sinon.
	*
	* UNE entree de table par expression, et non un pire cas commun a toutes. Un pire cas
	* paraissait plus sur — un decalage constant ne peut pas bouger quand l'expression change
	* — mais il est intenable : sur une capsule, `neutre` a les yeux hauts et demande a
	* descendre quand `effraye` les a bas et demande a monter. Aucune translation unique ne
	* satisfait les deux, et la mesure le confirme (4 debordements de 4,8 unites).
	*
	* Une entree par expression n'est pas moins fluide pour autant : le moteur interpole
	* entre DEUX CONSTANTES, ce qui est monotone par construction. Ce qui tremblait, c'etait
	* de re-resoudre le probleme sur un regard en cours d'interpolation.
	*/
	function visageDe(def, pose, expr) {
		if (def.baseFace && expr) return {
			gaze: expr.gaze,
			split: expr.split,
			eyes: expr.eyes
		};
		return {
			gaze: pose.gaze,
			split: pose.split,
			eyes: pose.eyes
		};
	}
	/** Les dates a echantillonner dans un etat : une seule si sa pose ne bouge pas. */
	function dates(def) {
		/** Tout ce dont le solveur se sert : si rien ne bouge, une date suffit. */
		const signature = (p) => JSON.stringify([
			p.gaze,
			p.split,
			p.eyes,
			p.sil.rot,
			p.sil.cx,
			p.sil.cy,
			p.sil.sx,
			p.sil.sy
		]);
		if (signature(def.pose(0)) === signature(def.pose(def.duration))) return [0];
		return Array.from({ length: 3 }, (_, i) => i / 2 * def.duration);
	}
	/** Le decalage d'une forme sur un etat et une expression, derive comprise. */
	function decalagePour(def, radii, expr) {
		const epreuves = [];
		for (const t of dates(def)) {
			const pose = def.pose(t);
			const contour = toPoints({
				...pose.sil,
				radii
			}, R);
			const calContour = toPoints(pose.sil, R);
			const v = visageDe(def, pose, expr);
			const coins = [];
			for (const dy of [-7.1, DERIVE_YAW]) for (const dp of [-5.5, DERIVE_PITCH]) coins.push({
				...v,
				gaze: {
					yaw: v.gaze.yaw + dy,
					pitch: v.gaze.pitch + dp,
					roll: v.gaze.roll
				}
			});
			for (const c of coins) epreuves.push({
				empreintes: empreintes(c, pose.sil, radii),
				reference: empreintes(c, pose.sil, pose.sil.radii),
				contour,
				calContour
			});
		}
		return resous(epreuves);
	}
	/** Zero, la valeur commune a tout ce qui n'a rien a corriger. */
	var NUL = {
		x: 0,
		y: 0
	};
	/** Clef d'une entree : l'etat, et l'expression quand l'etat l'accepte. */
	var clef = (state, expr) => `${state}|${expr ?? ""}`;
	/**
	* Table des decalages, batie a l'import : une entree par (forme, etat a corps de base,
	* expression). Seuls `idle` et `swirl` portent le visage de repos, donc seuls eux se
	* declinent par expression — les trois autres etats a corps de base ont un visage releve
	* sur la video et une seule entree.
	*
	* Clef par REFERENCE du tableau de rayons, ce qui est deja la convention du moteur : ses
	* gardes `radii === this.shape` et `expression === this.expr` reposent sur la meme
	* stabilite. Un profil inconnu, ou `null`, ne corrige rien — l'API accepte n'importe quel
	* tableau et le moteur n'a pas a dependre de la prudence de ses appelants.
	*/
	function batir() {
		return new Map(SHAPES.map((forme) => {
			const par = /* @__PURE__ */ new Map();
			for (const def of STATES) {
				if (!def.baseBody) continue;
				const expressions = def.baseFace ? [null, ...EXPRESSIONS] : [null];
				for (const expr of expressions) par.set(clef(def.id, expr?.id ?? null), decalagePour(def, forme.radii, expr));
			}
			return [forme.radii, par];
		}));
	}
	var DECALAGES = batir();
	/**
	* Decalage a appliquer aux deux yeux pour cette forme sur cet etat, en unites de rayon
	* de boule — le moteur le remet a son echelle.
	*
	* Vaut zero des que la forme n'est pas au catalogue, ce qui couvre `null` et le cercle :
	* sur le cercle les deux profils sont le meme, donc la marge est deja celle exigee et la
	* descente sort au premier tour. La forme relevee sur la video ne bouge donc pas, sans
	* cas particulier.
	*/
	function decalageDesYeux(radii, state, expr) {
		if (!radii) return NUL;
		const par = DECALAGES.get(radii);
		if (!par) return NUL;
		return par.get(clef(state, expr)) ?? par.get(clef(state, null)) ?? NUL;
	}
	//#endregion
	//#region src/bot/engine.ts
	var NO_LOOK = {
		yaw: 0,
		pitch: 0,
		mix: 0,
		spin: 0,
		wander: 1
	};
	var lerpLook = (a, b, t) => ({
		yaw: lerp(a.yaw, b.yaw, t),
		pitch: lerp(a.pitch, b.pitch, t),
		mix: lerp(a.mix, b.mix, t),
		spin: lerp(a.spin, b.spin, t),
		wander: lerp(a.wander, b.wander, t)
	});
	var lerpEye = (a, b, t) => ({
		w: lerp(a.w, b.w, t),
		h: lerp(a.h, b.h, t),
		open: lerp(a.open, b.open, t),
		tilt: lerp(a.tilt ?? 0, b.tilt ?? 0, t)
	});
	/** Interpolation de deux poses. Le decor se croise en opacite, pas en geometrie. */
	function blendPose(a, b, t) {
		const out = 1 - t;
		return {
			sil: blend(a.sil, b.sil, t),
			offX: lerp(a.offX, b.offX, t),
			offY: lerp(a.offY, b.offY, t),
			gaze: {
				yaw: lerp(a.gaze.yaw, b.gaze.yaw, t),
				pitch: lerp(a.gaze.pitch, b.gaze.pitch, t),
				roll: lerp(a.gaze.roll, b.gaze.roll, t)
			},
			split: lerp(a.split, b.split, t),
			eyes: [lerpEye(a.eyes[0], b.eyes[0], t), lerpEye(a.eyes[1], b.eyes[1], t)],
			eyeAlpha: lerp(a.eyeAlpha, b.eyeAlpha, t),
			bodyAlpha: lerp(a.bodyAlpha, b.bodyAlpha, t),
			dots: [...a.dots.map((d) => ({
				...d,
				opacity: d.opacity * out
			})), ...b.dots.map((d) => ({
				...d,
				opacity: d.opacity * t
			}))],
			arcs: [...a.arcs.map((r) => ({
				...r,
				id: `a${r.id}`,
				opacity: r.opacity * out
			})), ...b.arcs.map((r) => ({
				...r,
				id: `b${r.id}`,
				opacity: r.opacity * t
			}))],
			notif: t < .5 ? a.notif : b.notif,
			dotsBehind: t < .5 ? a.dotsBehind : b.dotsBehind
		};
	}
	/**
	* Moteur sans horloge : `sample(t)` est une fonction pure du temps.
	*
	* Consequence pratique : pause, reprise, ralenti et saut a une date arbitraire
	* donnent exactement la meme image, et le rendu est testable sans DOM.
	*/
	var BotEngine = class BotEngine {
		/** rayon de la boule au repos, en unites de viewBox */
		scale;
		cur;
		prev = null;
		/**
		* Pose de depart FIGEE, posee seulement quand un changement d'etat arrive alors qu'un
		* fondu est deja en cours. Cf. `setState`.
		*/
		departFige = null;
		tCur = 0;
		tPrev = 0;
		blinkAt = -10;
		pts = [];
		shape = null;
		shapePrev = null;
		shapeAt = -10;
		expr = null;
		exprPrev = null;
		exprAt = -10;
		look = NO_LOOK;
		lookPrev = NO_LOOK;
		lookAt = -10;
		/** duree de rattrapage en cours ; voir `LOOK_MORPH`, sa valeur par defaut */
		lookMorph = .24;
		/** duree du morph quand on change la forme du corps */
		static SHAPE_MORPH = .45;
		/**
		* Duree de rattrapage du regard vers la cible. Plus court que `SHAPE_MORPH` :
		* un regard qui suit doit paraitre attentif, pas visqueux. Comme la cible est
		* reposee a chaque mouvement de souris, c'est cette duree qui donne au suivi
		* son inertie — le regard n'atteint jamais tout a fait un curseur qui bouge.
		*/
		static LOOK_MORPH = .24;
		constructor(scale = 100, initial = "idle", shape = null, expression = null) {
			this.scale = scale;
			this.cur = initial;
			this.shape = shape;
			this.expr = expression;
		}
		/**
		* Expression de repos choisie dans le personnalisateur. Comme la forme, elle
		* glisse vers la nouvelle valeur au lieu de sauter.
		*/
		setExpression(expression, now = 0) {
			if (expression === this.expr) return;
			this.exprPrev = this.expr;
			this.expr = expression;
			this.exprAt = now;
		}
		/** Expression effective a l'instant `now`, morph en cours compris. */
		exprAtTime(now) {
			const to = this.expr;
			const from = this.exprPrev;
			if (!to || !from) return to;
			const k = (now - this.exprAt) / BotEngine.SHAPE_MORPH;
			if (k >= 1) return to;
			return blendExpression(from, to, easings.easeOutQuint(clamp(k)));
		}
		/**
		* Forme choisie dans le personnalisateur. Elle ne remplace le corps que sur
		* les etats au repos (`baseBody`) : sur les autres, la silhouette EST
		* l'animation et ne doit pas etre ecrasee.
		*
		* Le changement se fait en morph, pas d'un coup : comme toutes les formes sont
		* echantillonnees aux memes angles, il suffit d'interpoler les rayons.
		*/
		setShape(radii, now = 0) {
			if (radii === this.shape) return;
			this.shapePrev = this.shape;
			this.shape = radii;
			this.shapeAt = now;
		}
		/**
		* Forme effective a l'instant `now`, morph en cours compris.
		*
		* Ne remet PAS `shapePrev` a null en fin de morph : `sample` doit rester une
		* fonction pure du temps, donc relire une date passee doit redonner l'image
		* intermediaire. On garde juste une reference de plus.
		*/
		shapeAtTime(now) {
			const to = this.shape;
			const from = this.shapePrev;
			if (!to || !from) return to;
			const k = (now - this.shapeAt) / BotEngine.SHAPE_MORPH;
			if (k >= 1) return to;
			const t = easings.easeOutQuint(clamp(k));
			return to.map((r, i) => lerp(from[i] ?? r, r, t));
		}
		/**
		* Nouvelle cible de regard, `null` pour revenir a celui de l'etat.
		*
		* Elle repart de la valeur COURANTE, et non de la cible precedente comme
		* `setShape` : cette methode est appelee a chaque mouvement de pointeur, et
		* repartir de l'ancienne cible ferait reculer le regard d'un cran avant
		* chaque rattrapage — le suivi tremblerait au lieu de glisser.
		*
		* Meme contrat que `setShape` par ailleurs : l'etat externe entre par un
		* setter horodate, jamais par une variable lue pendant `sample`, sinon le
		* moteur cesse d'etre une fonction pure du temps.
		*/
		setLook(look, now, morph = BotEngine.LOOK_MORPH) {
			if (look && !Number.isFinite(look.yaw + look.pitch + look.mix + look.spin + look.wander)) return;
			this.lookPrev = this.lookAtTime(now);
			this.look = look ?? NO_LOOK;
			this.lookAt = now;
			this.lookMorph = morph;
		}
		/** Regard effectif a l'instant `now`, rattrapage en cours compris. */
		lookAtTime(now) {
			const k = (now - this.lookAt) / this.lookMorph;
			if (k >= 1) return this.look;
			return lerpLook(this.lookPrev, this.look, easings.easeOutQuint(clamp(k)));
		}
		posed(def, t, shape, expr) {
			let pose = def.pose(t);
			if (def.baseBody && shape) pose = {
				...pose,
				sil: {
					...pose.sil,
					radii: shape
				}
			};
			if (def.baseFace && expr) pose = {
				...pose,
				gaze: expr.gaze,
				split: expr.split,
				eyes: expr.eyes
			};
			return pose;
		}
		/**
		* Decalage des yeux a l'instant `now` pour un etat donne, en unites de rayon de boule.
		*
		* Il est LU dans une table et interpole, jamais recalcule : `eyefit.ts` explique
		* pourquoi cette distinction est tout le correctif. Ici il ne reste qu'a l'interpoler
		* sur l'axe de la forme, avec exactement la courbe et la duree du morph de silhouette
		* — c'est la meme cause, donc ce doit etre le meme mouvement.
		*
		* On interroge la table sur les BORNES du morph (`shapePrev` et `shape`) et non sur le
		* profil que rend `shapeAtTime` : celui-la est un tableau neuf alloue a chaque image,
		* donc sans identite, et il n'existe dans aucune table.
		*/
		decalageAtTime(now, state) {
			/**
			* Un axe de morph : on lit la table sur ses deux BORNES et on interpole avec sa
			* courbe. Jamais sur la valeur interpolee — celle-la n'a pas d'identite et n'existe
			* dans aucune table, et c'est en la lui donnant a manger que les versions
			* precedentes tremblaient.
			*/
			const surAxe = (debut, duree, a, b) => {
				if (a === b) return b;
				const k = (now - debut) / duree;
				if (k >= 1) return b;
				const t = easings.easeOutQuint(clamp(k));
				return {
					x: lerp(a.x, b.x, t),
					y: lerp(a.y, b.y, t)
				};
			};
			const parForme = (radii) => surAxe(this.exprAt, BotEngine.SHAPE_MORPH, decalageDesYeux(radii, state, this.exprPrev?.id ?? null), decalageDesYeux(radii, state, this.expr?.id ?? null));
			return surAxe(this.shapeAt, BotEngine.SHAPE_MORPH, parForme(this.shapePrev), parForme(this.shape));
		}
		get state() {
			return this.cur;
		}
		/**
		* Repart sur `id` SANS etat precedent, comme un moteur neuf pose sur cet etat.
		*
		* C'est ce que veut dire « rembobiner » pour ce moteur. `setState` seul ne peut pas le
		* faire : il garde l'etat quitte pour le fondre, ce qui est exactement son role en
		* lecture, et exactement ce qu'il ne faut pas quand on revient au debut d'une sequence.
		* Rejouer l'image 0 apres une passe complete melangeait le premier etat avec le DERNIER,
		* et l'export GIF s'ouvrait sur une boule sans yeux — la comete a un `eyeAlpha` nul.
		*
		* `sample` reste une fonction pure du temps : comme `setState`, ceci est un setter DATE,
		* appele par le pilote de la sequence, jamais pendant un echantillonnage.
		*/
		reset(id, now) {
			this.cur = id;
			this.prev = null;
			this.departFige = null;
			this.tCur = now;
			this.tPrev = now;
			this.blinkAt = -10;
		}
		/**
		* Origine du fondu en cours : la pose figee s'il y en a une, sinon l'etat quitte evalue
		* a son propre temps ecoule — donc encore en train de s'animer, ce qui est voulu.
		*/
		origine(now, shape, expr) {
			if (this.departFige) return this.departFige;
			if (!this.prev) return null;
			const prevDef = STATE_BY_ID.get(this.prev);
			return this.posed(prevDef, Math.max(0, now - this.tPrev), shape, expr);
		}
		/**
		* Pose composite a l'instant `now`, fondu en cours compris : exactement ce que `sample`
		* melange, avant la couche de vie au repos et de regard. Extraite pour que `setState`
		* puisse la figer.
		*/
		poseComposee(now) {
			const def = STATE_BY_ID.get(this.cur);
			const shape = this.shapeAtTime(now);
			const expr = this.exprAtTime(now);
			const pose = this.posed(def, Math.max(0, now - this.tCur), shape, expr);
			const since = now - this.tCur;
			if (since >= def.morph) return pose;
			const origine = this.origine(now, shape, expr);
			if (!origine) return pose;
			return blendPose(origine, pose, easings.easeOutQuint(clamp(since / def.morph)));
		}
		/**
		* Changement d'etat, date.
		*
		* Le moteur ne garde qu'UNE case d'historique, donc un changement qui arrive pendant un
		* fondu remplacait l'origine du melange par la pose PLEINE de l'etat qu'on quittait, au
		* lieu de l'image partiellement melangee qui etait a l'ecran. Mesure sur
		* `idle -> wide -> idle` a 100 ms : 35,9 px de saut contre 8,0 px de mouvement normal.
		*
		* On fige donc la pose composite courante et on melange depuis elle. Continu par
		* construction, quel que soit le nombre de changements enchaines.
		*
		* Et SEULEMENT dans ce cas. Figer a chaque changement arreterait net l'animation de
		* l'etat qu'on quitte pendant tout le fondu — le « ! » d'`alert` se figerait en pleine
		* course — alors qu'il n'y a rien a corriger hors morph : l'etat quitte y est deja
		* exactement l'image affichee. La lecture d'un montage, dont les blocs durent au moins
		* le plus long fondu (`MIN_BLOCK`), ne fige donc jamais rien et rend au bit ce qu'elle
		* rendait.
		*/
		setState(id, now) {
			if (id === this.cur) return;
			const morph = STATE_BY_ID.get(this.cur).morph;
			const enPleinFondu = this.prev !== null && now - this.tCur < morph;
			this.departFige = enPleinFondu ? this.poseComposee(now) : null;
			this.prev = this.cur;
			this.tPrev = this.tCur;
			this.cur = id;
			this.tCur = now;
			if (STATE_BY_ID.get(id)?.blinkIn) this.blinkAt = now;
		}
		sample(now) {
			const R = this.scale;
			const def = STATE_BY_ID.get(this.cur);
			const shape = this.shapeAtTime(now);
			const expr = this.exprAtTime(now);
			let pose = this.posed(def, Math.max(0, now - this.tCur), shape, expr);
			let decalage = this.decalageAtTime(now, this.cur);
			const since = now - this.tCur;
			const origine = since < def.morph ? this.origine(now, shape, expr) : null;
			if (origine) {
				const ratio = easings.easeOutQuint(clamp(since / def.morph));
				pose = blendPose(origine, pose, ratio);
				const quitte = this.prev;
				if (quitte) {
					const avant = this.decalageAtTime(now, quitte);
					decalage = {
						x: lerp(avant.x, decalage.x, ratio),
						y: lerp(avant.y, decalage.y, ratio)
					};
				}
			}
			const alive = pose.eyeAlpha > .01;
			const look = this.lookAtTime(now);
			const life = liveliness(now, {
				wander: alive ? look.wander : 0,
				blink: alive
			});
			const gaze = {
				yaw: lerp(pose.gaze.yaw, look.yaw, look.mix) + life.dYaw - look.spin,
				pitch: lerp(pose.gaze.pitch, look.pitch, look.mix) + life.dPitch,
				roll: pose.gaze.roll + life.dRoll
			};
			const forced = clamp((now - this.blinkAt) / .2);
			const forcedLid = forced < 1 ? Math.abs(forced * 2 - 1) : 1;
			const lid = Math.min(life.lid, forcedLid);
			const offX = pose.offX + life.driftX;
			const offY = pose.offY + life.driftY;
			const bodyPath = closedPath(toPoints({
				...pose.sil,
				cx: pose.sil.cx + offX,
				cy: pose.sil.cy + offY,
				sy: pose.sil.sy * life.breath
			}, R, this.pts));
			const bodyRadius = (x, y) => radiusAtAngle(pose.sil.radii, Math.atan2(y, x) - pose.sil.rot);
			const eyes = [];
			if (pose.eyeAlpha > .01) {
				const poses = eyePoses(gaze, R, pose.split);
				for (let i = 0; i < 2; i++) {
					const e = poses[i];
					if (e.depth <= .02) continue;
					const cfg = pose.eyes[i];
					const fit = bodyRadius(e.x, e.y);
					const phi = (cfg.tilt ?? 0) * Math.PI / 180;
					const cp = Math.cos(phi);
					const sp = Math.sin(phi);
					const ax = e.a * cp + e.c * sp;
					const ay = e.b * cp + e.d * sp;
					const cx2 = -e.a * sp + e.c * cp;
					const cy2 = -e.b * sp + e.d * cp;
					const k = blinkScale(Math.min(lid, cfg.open));
					eyes.push({
						d: capsulePath(cfg.w * R, cfg.h * R),
						matrix: `matrix(${r2(ax)},${r2(ay * k)},${r2(cx2)},${r2(cy2 * k)},${r2(e.x * fit + (offX + decalage.x) * R)},${r2(e.y * fit + (offY + decalage.y) * R)})`,
						alpha: pose.eyeAlpha * clamp(e.depth / .12)
					});
				}
			}
			const dots = pose.dots.filter((p) => p.opacity > .01 && p.r > 5e-4).map((p) => ({
				...p,
				x: (p.x + offX) * R,
				y: (p.y + offY) * R,
				r: p.r * R
			}));
			const nFit = pose.notif ? bodyRadius(pose.notif.x, pose.notif.y) : 1;
			const nx = pose.notif ? (pose.notif.x * nFit + offX) * R : 0;
			const ny = pose.notif ? (pose.notif.y * nFit + offY) * R : 0;
			const notif = pose.notif ? {
				x: nx,
				y: ny,
				r: pose.notif.r * R
			} : null;
			const notch = pose.notif ? {
				x: nx,
				y: ny,
				r: pose.notif.notch * R
			} : null;
			return {
				bodyPath,
				bodyAlpha: pose.bodyAlpha,
				eyes,
				dots,
				dotsBehind: pose.dotsBehind,
				arcs: pose.arcs.filter((a) => a.opacity > .01).map((a) => arcRender(a.seed, a.t, R, a.id, a.opacity)),
				notif,
				notch
			};
		}
	};
	//#endregion
	//#region core-entry.ts
	var EXPRESSION_IDS = [
		"neutre",
		"confus",
		"excite",
		"somnolent"
	];
	var nextMaskId = 0;
	function esc(value) {
		return value.replaceAll("&", "&amp;").replaceAll("\"", "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
	}
	var ReadYourselfBloubAvatar = class {
		engine = new BotEngine(100, "idle", null, EXPRESSION_BY_ID.get("neutre"));
		host = null;
		state = "listen";
		startedAt = performance.now();
		raf = 0;
		ink = "#16151a";
		paper = "#f4efe8";
		card = false;
		maskId = `read-yourself-bloub-mask-${++nextMaskId}`;
		attach(host) {
			this.host = host;
			this.startedAt = performance.now();
			this.render();
			const tick = () => {
				if (!this.host) return;
				this.render();
				this.raf = requestAnimationFrame(tick);
			};
			this.raf = requestAnimationFrame(tick);
		}
		configure(options = {}) {
			if (options.ink) this.ink = options.ink;
			if (options.paper) this.paper = options.paper;
			if (options.card != null) this.card = Boolean(options.card);
			this.render();
		}
		setState(state) {
			this.state = state;
			const now = (performance.now() - this.startedAt) / 1e3;
			const faceMap = {
				listen: "neutre",
				confused: "confus",
				interest: "excite",
				drop: "somnolent"
			};
			const faceId = faceMap[state] || (EXPRESSION_BY_ID.has(state) ? state : null);
			if (faceId) {
				this.engine.setExpression(EXPRESSION_BY_ID.get(faceId), now);
				if (this.engine.cur !== "idle") this.engine.setState("idle", now);
				this.render();
				return true;
			}
			if (STATE_BY_ID.has(state)) {
				this.engine.setState(state, now);
				this.render();
				return true;
			}
			return false;
		}
		render() {
			if (!this.host) return;
			const now = (performance.now() - this.startedAt) / 1e3;
			const frame = this.engine.sample(now);
			const paper = String(this.paper || "transparent");
			const hasPaper = !/^transparent$/i.test(paper) && !/^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*0\s*\)$/i.test(paper);
			const background = this.card && hasPaper ? `<rect class="v2-audience-bloub-card" x="-125" y="-125" width="250" height="250" fill="${esc(paper)}"/>` : "";
			const eyes = frame.eyes.map((eye) => `<path d="${esc(eye.d)}" transform="${esc(eye.matrix)}" fill="black" opacity="${eye.alpha}"/>`).join("");
			const paintedEyes = hasPaper ? frame.eyes.map((eye) => `<path class="v2-audience-bloub-eye" d="${esc(eye.d)}" transform="${esc(eye.matrix)}" fill="${esc(paper)}" opacity="${eye.alpha}"/>`).join("") : "";
			const mask = `<mask id="${this.maskId}" mask-type="luminance" maskUnits="userSpaceOnUse" x="-125" y="-125" width="250" height="250"><rect x="-125" y="-125" width="250" height="250" fill="black"/><path d="${esc(frame.bodyPath)}" fill="white" opacity="${frame.bodyAlpha}"/>${eyes}</mask>`;
			const dots = frame.dots.map((dot) => `<circle cx="${dot.x}" cy="${dot.y}" r="${dot.r}" fill="${dot.color || this.ink}" opacity="${dot.opacity}"/>`).join("");
			this.host.innerHTML = `<svg class="v2-audience-bloub" viewBox="-125 -125 250 250" role="img" aria-label="Read Yourself 数字观众">${background}<defs>${mask}</defs><path d="${esc(frame.bodyPath)}" fill="${esc(this.ink)}" mask="url(#${this.maskId})"/>${paintedEyes}${dots}</svg>`;
			this.host.dataset.bloubState = this.state;
		}
		destroy() {
			cancelAnimationFrame(this.raf);
			this.host = null;
		}
	};
	function createBloubAvatar(options = {}) {
		const avatar = new ReadYourselfBloubAvatar();
		avatar.ink = options.ink || avatar.ink;
		avatar.paper = options.paper || avatar.paper;
		if (options.card != null) avatar.card = Boolean(options.card);
		return avatar;
	}
	//#endregion
	exports.ReadYourselfBloubAvatar = ReadYourselfBloubAvatar;
	exports.createBloubAvatar = createBloubAvatar;
	exports.FACE_IDS = EXPRESSIONS.map((item) => item.id);
	exports.MOTION_IDS = STATES.map((item) => item.id);
	return exports;
})({});
