const fs = require('node:fs');
const path = require('node:path');
const { getASRStatus } = require('../lib/asr');
const { readWav, runCurrentStreamingParaformer, transcriptMetrics } = require('../lib/stt-benchmark');

function percent(value) { return `${(value * 100).toFixed(2)}%`; }
function average(values) { return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0; }

async function main() {
  const manifestArgument = process.argv[2];
  if (!manifestArgument) {
    throw new Error('用法：npm run benchmark:stt -- benchmarks/stt/manifest.json');
  }
  const manifestPath = path.resolve(process.cwd(), manifestArgument);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (manifest.version !== 1 || !Array.isArray(manifest.cases) || !manifest.cases.length) {
    throw new Error('清单必须使用 version 1，并至少包含一条 cases。');
  }
  const manifestDir = path.dirname(manifestPath);
  const modelStatus = getASRStatus();
  if (!modelStatus.ready) throw new Error(`当前模型不完整：${modelStatus.missingFiles.join('、')}`);

  const results = [];
  for (const item of manifest.cases) {
    if (!item.id || !item.audio || typeof item.reference !== 'string') throw new Error('每条样本都需要 id、audio 和人工校对的 reference。');
    const audioPath = path.resolve(manifestDir, item.audio);
    const audio = readWav(audioPath);
    const recognition = await runCurrentStreamingParaformer(audio.samples, manifest.options || {});
    const metrics = transcriptMetrics(item.reference, recognition.hypothesis);
    results.push({
      id: item.id,
      language: item.language || 'unknown',
      tags: Array.isArray(item.tags) ? item.tags : [],
      audio: path.relative(process.cwd(), audioPath),
      reference: item.reference,
      ...audio,
      samples: undefined,
      ...recognition,
      ...metrics,
      realTimeFactor: audio.durationMs ? recognition.inferenceMs / audio.durationMs : null
    });
    const current = results.at(-1);
    process.stdout.write(`${current.id}\tCER ${percent(current.cer)}\tRTF ${current.realTimeFactor.toFixed(3)}\t${current.hypothesis}\n`);
  }

  const report = {
    version: 1,
    createdAt: new Date().toISOString(),
    model: modelStatus,
    environment: { platform: process.platform, arch: process.arch, node: process.version },
    summary: {
      cases: results.length,
      averageCer: average(results.map(result => result.cer)),
      averageMixedTokenErrorRate: average(results.map(result => result.mixedTokenErrorRate)),
      averageRealTimeFactor: average(results.map(result => result.realTimeFactor).filter(Number.isFinite)),
      averageFirstPartialAudioMs: average(results.map(result => result.firstPartialAudioMs).filter(Number.isFinite))
    },
    results
  };
  const outputDir = path.resolve(process.cwd(), 'benchmarks', 'stt', 'results');
  fs.mkdirSync(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, `current-${report.createdAt.replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
  process.stdout.write(`\n平均 CER ${percent(report.summary.averageCer)} · 平均 RTF ${report.summary.averageRealTimeFactor.toFixed(3)}\n`);
  process.stdout.write(`报告：${outputPath}\n`);
}

main().catch(error => {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
});
