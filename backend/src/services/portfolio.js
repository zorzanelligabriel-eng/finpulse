const { findQuote } = require('./marketService');

const round2 = (value) => Math.round(value * 100) / 100;

/**
 * Calcula quanto vale a carteira com as cotações do momento.
 * Função pura: recebe os ativos e as cotações, devolve os números. Fácil de testar.
 */
function valuatePortfolio(assets, snapshot) {
  const positions = assets.map((asset) => {
    const quote = findQuote(snapshot, asset.kind, asset.code);
    if (!quote) {
      // ativo sem cotação no momento (ex.: saiu do top 10)
      return { ...asset, priceBrl: null, valueBrl: null, change24h: null, profitBrl: null, profitPercent: null };
    }
    const valueBrl = round2(asset.quantity * quote.priceBrl);
    const hasCost = asset.investedBrl != null && asset.investedBrl > 0;
    const profitBrl = hasCost ? round2(valueBrl - asset.investedBrl) : null;
    return {
      ...asset,
      priceBrl: quote.priceBrl,
      valueBrl,
      change24h: quote.change24h,
      profitBrl,
      profitPercent: hasCost ? round2((profitBrl / asset.investedBrl) * 100) : null,
    };
  });

  const priced = positions.filter((position) => position.valueBrl != null);
  const totalBrl = round2(priced.reduce((sum, position) => sum + position.valueBrl, 0));

  // Quanto a carteira valia 24h atrás: desfaz a variação percentual de cada posição.
  const total24hAgo = priced.reduce((sum, position) => sum + position.valueBrl / (1 + position.change24h / 100), 0);

  const withCost = priced.filter((position) => position.profitBrl != null);
  const investedBrl = round2(withCost.reduce((sum, position) => sum + position.investedBrl, 0));
  const profitBrl = round2(withCost.reduce((sum, position) => sum + position.profitBrl, 0));

  return {
    positions,
    totals: {
      totalBrl,
      change24hBrl: round2(totalBrl - total24hAgo),
      change24hPercent: total24hAgo > 0 ? round2(((totalBrl - total24hAgo) / total24hAgo) * 100) : 0,
      investedBrl,
      profitBrl,
      profitPercent: investedBrl > 0 ? round2((profitBrl / investedBrl) * 100) : null,
    },
  };
}

module.exports = { valuatePortfolio };
