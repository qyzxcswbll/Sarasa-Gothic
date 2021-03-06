"use strict";

const { rebase, introduce, build, merge, manip } = require("megaminx");

const { italize } = require("../common/italize");
const { nameFont, setHintFlag } = require("./metadata.js");
const { crossTransfer } = require("./cross-transfer");
const { knockoutSymbols } = require("./knockout-symbols");
const { buildNexusDash } = require("./nexus-dash");
const { toTNUM } = require("./tnum");
const gc = require("../common/gc");

const fs = require("fs-extra");
const path = require("path");

const globalConfig = fs.readJsonSync(path.resolve(__dirname, "../../config.json"));
const packageConfig = fs.readJsonSync(path.resolve(__dirname, "../../package.json"));
const ENCODINGS = globalConfig.os2encodings;

async function pass(ctx, config, argv) {
	const a = await ctx.run(introduce, "a", {
		from: argv.main,
		prefix: "a",
		ignoreHints: true
	});
	await ctx.run(rebase, "a", { scale: 1000 / a.head.unitsPerEm });
	const b = await ctx.run(introduce, "b", {
		from: argv.asian,
		prefix: "b",
		ignoreHints: true
	});
	const c = await ctx.run(introduce, "c", {
		from: argv.ws,
		prefix: "c",
		ignoreHints: true
	});

	// tnum
	if (argv.tnum) {
		await ctx.run(manip.glyph, "a", toTNUM);
	}

	// vhea
	a.vhea = b.vhea;
	for (let g in a.glyf) {
		a.glyf[g].verticalOrigin = a.head.unitsPerEm * 0.88;
		a.glyf[g].advanceHeight = a.head.unitsPerEm;
	}

	// italize
	if (argv.italize) {
		italize(a, -10);
		italize(c, -10);
	}

	knockoutSymbols(a, { enclosedAlphaNumerics: !argv.mono, pua: !argv.mono });

	crossTransfer(ctx.items.a, ctx.items.b, [0x2010, 0x2011, 0x2012, 0x2013, 0x2014, 0x2015]);

	// merge and build
	await ctx.run(merge.below, "a", "a", "c", { mergeOTL: true });
	await ctx.run(merge.above, "a", "a", "b", { mergeOTL: true });
	await ctx.run(manip.glyph, "a", buildNexusDash);

	await ctx.run(setHintFlag, "a");
	await ctx.run(
		nameFont,
		"a",
		!!argv.mono,
		globalConfig.nameTupleSelector[argv.subfamily],
		ENCODINGS[argv.subfamily],
		{
			en_US: {
				copyright: globalConfig.copyright,
				version: `Version ${packageConfig.version}`,
				family: globalConfig.families[argv.family].naming.en_US + " " + argv.subfamily,
				style: globalConfig.styles[argv.style].name
			},
			zh_CN: {
				family: globalConfig.families[argv.family].naming.zh_CN + " " + argv.subfamily,
				style: globalConfig.styles[argv.style].name
			},
			zh_TW: {
				family: globalConfig.families[argv.family].naming.zh_TW + " " + argv.subfamily,
				style: globalConfig.styles[argv.style].name
			},
			zh_HK: {
				family: globalConfig.families[argv.family].naming.zh_HK + " " + argv.subfamily,
				style: globalConfig.styles[argv.style].name
			},
			ja_JP: {
				family: globalConfig.families[argv.family].naming.ja_JP + " " + argv.subfamily,
				style: globalConfig.styles[argv.style].name
			}
		}
	);

	if (argv.italize) italize(a, +10);
	ctx.items.a.glyph_order = gc(ctx.items.a);
	await ctx.run(build, "a", { to: config.o });
}

module.exports = async function makeFont(ctx, config, argv) {
	await pass(ctx, { o: argv.o }, argv);
};
