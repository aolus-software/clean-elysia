/**
 * Fails when total line coverage in coverage/lcov.info is below the gate. The
 * gate is the current baseline; raise it as tests land (issue #18 asks for
 * coverage checks in CI). Bun's own coverageThreshold applies to every file
 * separately, so it cannot express a whole-project minimum.
 */
const MIN_LINE_COVERAGE = 64;

const lcov = await Bun.file("coverage/lcov.info").text();
let found = 0;
let hit = 0;
for (const line of lcov.split("\n")) {
	if (line.startsWith("LF:")) found += Number(line.slice(3));
	if (line.startsWith("LH:")) hit += Number(line.slice(3));
}

const percent = found === 0 ? 0 : (hit / found) * 100;
process.stdout.write(
	`Line coverage ${percent.toFixed(2)}% (minimum ${MIN_LINE_COVERAGE}%)\n`,
);
if (percent < MIN_LINE_COVERAGE) process.exit(1);

export {};
