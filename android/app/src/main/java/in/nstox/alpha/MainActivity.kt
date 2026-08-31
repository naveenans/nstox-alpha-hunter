package com.nstox.alpha

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import kotlinx.coroutines.delay
import java.util.Locale
import kotlin.math.max

private val Bg = Color(0xFF030711)
private val Panel = Color(0xFF09111F)
private val Panel2 = Color(0xFF0D1728)
private val Cyan = Color(0xFF39F4FF)
private val Pink = Color(0xFFFF4A9E)
private val Yellow = Color(0xFFFFC947)
private val Green = Color(0xFF43F39B)
private val Red = Color(0xFFFF5C78)
private val Violet = Color(0xFF9C70FF)
private val TextMuted = Color(0xFF8797AE)

data class DashboardSection(val title: String, val icon: String)
data class GlobalSpec(val symbol: String, val name: String, val domain: String)
data class CommoditySpec(val symbol: String, val name: String, val domain: String)

private val sections = listOf(
    DashboardSection("Global Indices", "◎"), DashboardSection("Indian Indices", "◆"),
    DashboardSection("Commodities", "◈"), DashboardSection("Top Movers", "↕"),
    DashboardSection("FII & DII", "₹"), DashboardSection("Block & Bulk", "▦"),
    DashboardSection("Volume Shockers", "▥"), DashboardSection("52W Breakouts", "△"),
    DashboardSection("AI News", "✦")
)

private val globalSpecs = listOf(
    GlobalSpec("NIFTY=F", "GIFT Nifty", "niftyindices.com"),
    GlobalSpec("^IXIC", "NASDAQ", "nasdaq.com"),
    GlobalSpec("^DJI", "Dow Jones", "spglobal.com"),
    GlobalSpec("^GSPC", "S&P 500", "spglobal.com"),
    GlobalSpec("^GDAXI", "DAX", "deutsche-boerse.com"),
    GlobalSpec("^FTSE", "FTSE 100", "lseg.com"),
    GlobalSpec("^HSI", "Hang Seng", "hsi.com.hk"),
    GlobalSpec("^N225", "Nikkei 225", "nikkei.com"),
    GlobalSpec("^TWII", "Taiwan", "twse.com.tw"),
    GlobalSpec("^AXJO", "ASX 200", "asx.com.au"),
    GlobalSpec("^FCHI", "CAC 40", "euronext.com"),
    GlobalSpec("IMOEX.ME", "Russia MOEX", "moex.com")
)

private val commoditySpecs = listOf(
    CommoditySpec("CL=F", "Crude Oil", "eia.gov"),
    CommoditySpec("BZ=F", "Brent Oil", "theice.com"),
    CommoditySpec("GC=F", "Gold", "gold.org"),
    CommoditySpec("SI=F", "Silver", "silverinstitute.org"),
    CommoditySpec("HG=F", "Copper", "copper.org"),
    CommoditySpec("NG=F", "Natural Gas", "eia.gov")
)

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { NstoxApp() }
    }
}

@Composable
fun NstoxApp() {
    var selected by remember { mutableIntStateOf(0) }
    var snapshot by remember { mutableStateOf(MarketSnapshot()) }
    var loading by remember { mutableStateOf(true) }

    LaunchedEffect(Unit) {
        while (true) {
            loading = true
            snapshot = MarketRepository.loadSnapshot()
            loading = false
            delay(15 * 60 * 1000L)
        }
    }

    MaterialTheme(colorScheme = darkColorScheme(background = Bg, surface = Panel, primary = Cyan, secondary = Pink)) {
        Box(Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(Color(0xFF07111F), Bg, Color(0xFF02050B))))) {
            Scaffold(containerColor = Color.Transparent, bottomBar = { BottomNav(selected) { selected = it } }) { padding ->
                Column(Modifier.fillMaxSize().padding(padding).padding(horizontal = 14.dp)) {
                    Spacer(Modifier.height(10.dp))
                    BrandHeader(sections[selected].title, snapshot, loading)
                    Spacer(Modifier.height(10.dp))
                    DashboardTabs(selected) { selected = it }
                    Spacer(Modifier.height(10.dp))
                    DashboardBody(selected, snapshot, loading)
                }
            }
        }
    }
}

@Composable
private fun BottomNav(selected: Int, onSelect: (Int) -> Unit) {
    val destinations = listOf(0, 4, 6, 8)
    NavigationBar(containerColor = Color(0xF2080E18), tonalElevation = 0.dp) {
        listOf("Markets", "Flows", "Scanner", "AI").forEachIndexed { i, label ->
            val active = when (i) { 0 -> selected in 0..3; 1 -> selected in 4..5; 2 -> selected in 6..7; else -> selected == 8 }
            NavigationBarItem(
                selected = active, onClick = { onSelect(destinations[i]) },
                colors = NavigationBarItemDefaults.colors(selectedIconColor = Cyan, selectedTextColor = Cyan, indicatorColor = Cyan.copy(.10f), unselectedIconColor = TextMuted, unselectedTextColor = TextMuted),
                icon = { Text(listOf("◈", "₹", "⌁", "✦")[i], fontSize = 17.sp) },
                label = { Text(label, fontSize = 9.sp, fontWeight = FontWeight.Bold) }
            )
        }
    }
}

@Composable
private fun BrandHeader(screen: String, snapshot: MarketSnapshot, loading: Boolean) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f)) {
            Text("NSTOX ALPHA", color = Color.White, fontWeight = FontWeight.Black, fontSize = 22.sp, letterSpacing = 1.5.sp)
            Text(screen.uppercase(), color = Cyan, fontWeight = FontWeight.Bold, fontSize = 10.sp)
        }
        Column(horizontalAlignment = Alignment.End) {
            StatusPill(if (loading) "SYNCING" else "LIVE", if (loading) Yellow else Green)
            Spacer(Modifier.height(4.dp))
            Text(snapshot.updatedAt, color = TextMuted, fontSize = 8.sp)
        }
    }
}

@Composable
private fun DashboardTabs(selected: Int, onSelect: (Int) -> Unit) {
    LazyRow(horizontalArrangement = Arrangement.spacedBy(7.dp)) {
        itemsIndexed(sections) { index, item ->
            val active = selected == index
            Box(
                Modifier.clip(RoundedCornerShape(12.dp))
                    .background(if (active) Brush.horizontalGradient(listOf(Pink.copy(.25f), Cyan.copy(.18f))) else Brush.horizontalGradient(listOf(Panel2, Panel2)))
                    .border(1.dp, if (active) Cyan.copy(.48f) else Color.White.copy(.06f), RoundedCornerShape(12.dp))
                    .then(androidx.compose.foundation.clickable { onSelect(index) })
                    .padding(horizontal = 12.dp, vertical = 9.dp)
            ) { Text("${item.icon} ${item.title}", color = if (active) Color.White else TextMuted, fontSize = 10.sp, fontWeight = if (active) FontWeight.Black else FontWeight.Medium) }
        }
    }
}

@Composable
private fun DashboardBody(index: Int, snapshot: MarketSnapshot, loading: Boolean) {
    val indian = snapshot.indices.filter { it.symbol in setOf("^NSEI", "^NSEBANK", "^BSESN") }
    val gainers = snapshot.stocks.sortedByDescending { it.changePct }.take(7)
    val losers = snapshot.stocks.sortedBy { it.changePct }.take(7)
    val volume = snapshot.stocks.filter { it.avgVolume20 > 0 && it.volume > 0 }.sortedByDescending { it.volumeRatio }.take(10)
    val breakouts = snapshot.stocks.filter { it.yearHigh > 0 && it.distanceToHighPct <= 5 }.sortedBy { it.distanceToHighPct }.take(10)

    LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp), contentPadding = PaddingValues(bottom = 24.dp)) {
        when (index) {
            0 -> { item { HeaderPanel("WORLD MARKETS", Cyan, loading) }; item { SectionTitle("GLOBAL INDICES") }; item { GlobalGrid(snapshot.indices) } }
            1 -> { item { HeaderPanel("INDIAN MARKETS", Yellow, loading) }; item { SectionTitle("INDIAN INDICES") }; items(indian) { IndexCard(it) }; item { BreadthPanel(snapshot.stocks) } }
            2 -> { item { HeaderPanel("COMMODITIES", Yellow, loading) }; item { CommodityGrid(snapshot.commodities) } }
            3 -> { item { HeaderPanel("TOP MOVERS", Pink, loading) }; item { SectionTitle("TOP GAINERS") }; items(gainers) { StockRow(it) }; item { SectionTitle("TOP LOSERS") }; items(losers) { StockRow(it) } }
            4 -> item { InstitutionalPanel(snapshot.institutional) }
            5 -> item { DealsPanel() }
            6 -> { item { HeaderPanel("VOLUME SHOCKERS", Yellow, loading) }; if (volume.isEmpty()) item { EmptyCard("Waiting for volume baseline") } else items(volume) { VolumeRow(it) } }
            7 -> { item { HeaderPanel("52W BREAKOUTS", Pink, loading) }; if (breakouts.isEmpty()) item { EmptyCard("No stocks near 52-week high") } else items(breakouts) { BreakoutRow(it) } }
            else -> item { AiNewsPanel(snapshot.news) }
        }
        snapshot.error?.let { item { StatusCard("DATA FEED", it, Red) } }
        item { SourceFooter() }
    }
}

@Composable
private fun HeaderPanel(title: String, accent: Color, loading: Boolean) {
    DepthCard(accent) { Row(verticalAlignment = Alignment.CenterVertically) { Text(title, color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.Black, modifier = Modifier.weight(1f)); StatusPill(if (loading) "SYNC" else "ACTIVE", if (loading) Yellow else Green) } }
}

@Composable
private fun SectionTitle(title: String) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.width(4.dp).height(17.dp).clip(CircleShape).background(Cyan)); Spacer(Modifier.width(8.dp)); Text(title, color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.Black, letterSpacing = .7.sp); Spacer(Modifier.weight(1f)); Text("NSTOX ALPHA", color = Cyan.copy(.55f), fontSize = 8.sp, fontWeight = FontWeight.Black)
    }
}

@Composable
private fun GlobalGrid(quotes: List<MarketQuote>) {
    Column(verticalArrangement = Arrangement.spacedBy(9.dp)) {
        globalSpecs.chunked(2).forEach { row -> Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(9.dp)) { row.forEach { spec -> GlobalCard(spec, quotes.firstOrNull { it.symbol == spec.symbol }, Modifier.weight(1f)) } } }
    }
}

@Composable
private fun GlobalCard(spec: GlobalSpec, q: MarketQuote?, modifier: Modifier = Modifier) {
    val accent = q?.let { signColor(it.changePct) } ?: TextMuted
    DepthCard(accent, modifier.height(140.dp), 14.dp) {
        Row(verticalAlignment = Alignment.CenterVertically) { RemoteLogo(spec.domain, 34.dp); Spacer(Modifier.width(8.dp)); Text(spec.name, color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.Black, maxLines = 1, overflow = TextOverflow.Ellipsis) }
        Spacer(Modifier.height(8.dp)); Text(q?.let { formatPrice(it.price) } ?: "—", color = Color.White, fontSize = 18.sp, fontWeight = FontWeight.Black); Text(q?.let { formatPct(it.changePct) } ?: "—", color = accent, fontSize = 10.sp, fontWeight = FontWeight.Bold); Spacer(Modifier.height(5.dp)); Sparkline(q?.history ?: emptyList(), accent, Modifier.fillMaxWidth().height(34.dp))
    }
}

@Composable
private fun IndexCard(q: MarketQuote) {
    val domain = if (q.symbol == "^BSESN") "bseindia.com" else "nseindia.com"
    val accent = signColor(q.changePct)
    DepthCard(accent) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            RemoteLogo(domain, 44.dp); Spacer(Modifier.width(11.dp)); Column(Modifier.weight(1f)) { Text(q.name, color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.Black); Text(formatPrice(q.price), color = Color.White, fontSize = 19.sp, fontWeight = FontWeight.Black); Text(formatPct(q.changePct), color = accent, fontSize = 10.sp, fontWeight = FontWeight.Bold) }; Sparkline(q.history, accent, Modifier.width(118.dp).height(55.dp))
        }
    }
}

@Composable
private fun CommodityGrid(quotes: List<MarketQuote>) {
    Column(verticalArrangement = Arrangement.spacedBy(9.dp)) { commoditySpecs.chunked(2).forEach { row -> Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(9.dp)) { row.forEach { spec -> CommodityCard(spec, quotes.firstOrNull { it.symbol == spec.symbol }, Modifier.weight(1f)) } } } }
}

@Composable
private fun CommodityCard(spec: CommoditySpec, q: MarketQuote?, modifier: Modifier = Modifier) {
    val accent = when (spec.symbol) { "GC=F" -> Yellow; "SI=F" -> Cyan; "HG=F" -> Pink; "NG=F" -> Violet; else -> q?.let { signColor(it.changePct) } ?: TextMuted }
    DepthCard(accent, modifier.height(148.dp), 14.dp) {
        Row(verticalAlignment = Alignment.CenterVertically) { RemoteLogo(spec.domain, 38.dp); Spacer(Modifier.width(8.dp)); Text(spec.name, color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.Black, maxLines = 1) }
        Spacer(Modifier.height(8.dp)); Text(q?.let { formatPrice(it.price) } ?: "—", color = Color.White, fontSize = 18.sp, fontWeight = FontWeight.Black); Text(q?.let { formatPct(it.changePct) } ?: "—", color = q?.let { signColor(it.changePct) } ?: TextMuted, fontSize = 9.sp, fontWeight = FontWeight.Bold); Spacer(Modifier.height(6.dp)); Sparkline(q?.history ?: emptyList(), accent, Modifier.fillMaxWidth().height(35.dp))
    }
}

@Composable
private fun StockRow(q: MarketQuote) {
    val accent = signColor(q.changePct)
    DepthCard(accent, corner = 14.dp) { Row(verticalAlignment = Alignment.CenterVertically) { StockLogo(q.symbol, 42.dp); Spacer(Modifier.width(10.dp)); Column(Modifier.weight(1f)) { Text(q.name, color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Black); Text(q.symbol.removeSuffix(".NS"), color = TextMuted, fontSize = 8.sp) }; Column(horizontalAlignment = Alignment.End) { Text(formatPrice(q.price), color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.Black); Text(formatPct(q.changePct), color = accent, fontSize = 10.sp, fontWeight = FontWeight.Bold) } } }
}

@Composable
private fun BreadthPanel(stocks: List<MarketQuote>) {
    val total = max(stocks.size, 1); val up = stocks.count { it.changePct > 0 }; val down = stocks.count { it.changePct < 0 }
    DepthCard(Violet) { Row(verticalAlignment = Alignment.CenterVertically) { DonutGauge(up.toDouble() / total, Violet); Spacer(Modifier.width(18.dp)); Column(Modifier.weight(1f)) { Text("MARKET BREADTH", color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.Black); Spacer(Modifier.height(7.dp)); Text("$up ADV", color = Green, fontSize = 11.sp, fontWeight = FontWeight.Bold); Text("$down DEC", color = Red, fontSize = 11.sp, fontWeight = FontWeight.Bold) } } }
}

@Composable
private fun VolumeRow(q: MarketQuote) {
    val ratio = q.volumeRatio; val accent = if (ratio >= 1.5) Yellow else Cyan
    DepthCard(accent, corner = 14.dp) { Row(verticalAlignment = Alignment.CenterVertically) { StockLogo(q.symbol, 42.dp); Spacer(Modifier.width(10.dp)); Column(Modifier.weight(1f)) { Text(q.name, color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Black); Text("VOL ${formatVolume(q.volume)}   AVG ${formatVolume(q.avgVolume20.toLong())}", color = TextMuted, fontSize = 8.sp); Spacer(Modifier.height(7.dp)); ProgressBar((ratio / 4.0).coerceIn(0.0, 1.0).toFloat(), accent) }; Spacer(Modifier.width(10.dp)); Text(String.format(Locale.US, "%.1f×", ratio), color = accent, fontSize = 17.sp, fontWeight = FontWeight.Black) } }
}

@Composable
private fun BreakoutRow(q: MarketQuote) {
    val dist = q.distanceToHighPct
    DepthCard(Pink, corner = 14.dp) { Row(verticalAlignment = Alignment.CenterVertically) { StockLogo(q.symbol, 42.dp); Spacer(Modifier.width(10.dp)); Column(Modifier.weight(1f)) { Text(q.name, color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Black); Text("52W ${formatPrice(q.yearHigh)}", color = TextMuted, fontSize = 8.sp) }; Column(horizontalAlignment = Alignment.End) { Text(formatPrice(q.price), color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.Black); Text(String.format(Locale.US, "%.2f%% AWAY", dist), color = if (dist <= 2) Green else Yellow, fontSize = 9.sp, fontWeight = FontWeight.Bold) } } }
}

@Composable
private fun InstitutionalPanel(flow: InstitutionalFlow?) {
    DepthCard(Pink) {
        Row(verticalAlignment = Alignment.CenterVertically) { Text("FII / DII", color = Color.White, fontSize = 19.sp, fontWeight = FontWeight.Black, modifier = Modifier.weight(1f)); Text(flow?.date ?: "—", color = TextMuted, fontSize = 9.sp) }
        Spacer(Modifier.height(14.dp))
        if (flow == null) EmptyCard("Flow feed unavailable") else { Row(horizontalArrangement = Arrangement.spacedBy(9.dp)) { FlowCard("FII", flow.fiiBuy, flow.fiiSell, flow.fiiNet, Pink, Modifier.weight(1f)); FlowCard("DII", flow.diiBuy, flow.diiSell, flow.diiNet, Cyan, Modifier.weight(1f)) }; Spacer(Modifier.height(9.dp)); Text(flow.source, color = TextMuted, fontSize = 8.sp) }
    }
}

@Composable
private fun FlowCard(label: String, buy: Double, sell: Double, net: Double, accent: Color, modifier: Modifier) {
    Column(modifier.clip(RoundedCornerShape(14.dp)).background(accent.copy(.07f)).border(1.dp, accent.copy(.20f), RoundedCornerShape(14.dp)).padding(11.dp)) { Text(label, color = accent, fontSize = 12.sp, fontWeight = FontWeight.Black); Spacer(Modifier.height(7.dp)); Text("BUY ${formatCrore(buy)}", color = Green, fontSize = 9.sp, fontWeight = FontWeight.Bold); Text("SELL ${formatCrore(sell)}", color = Red, fontSize = 9.sp, fontWeight = FontWeight.Bold); Spacer(Modifier.height(7.dp)); Text(formatCrore(net), color = signColor(net), fontSize = 16.sp, fontWeight = FontWeight.Black) }
}

@Composable
private fun DealsPanel() {
    DepthCard(Yellow) { Text("BLOCK & BULK DEALS", color = Color.White, fontSize = 18.sp, fontWeight = FontWeight.Black); Spacer(Modifier.height(12.dp)); StatusCard("BLOCK DEALS", "VERIFIED FEED PENDING", Yellow); Spacer(Modifier.height(8.dp)); StatusCard("BULK DEALS", "VERIFIED FEED PENDING", Pink) }
}

@Composable
private fun AiNewsPanel(news: List<NewsItem>) {
    DepthCard(Violet) {
        Row(verticalAlignment = Alignment.CenterVertically) { Text("AI MARKET NEWS", color = Color.White, fontSize = 18.sp, fontWeight = FontWeight.Black, modifier = Modifier.weight(1f)); StatusPill(if (news.isEmpty()) "WAIT" else "${news.size} ITEMS", if (news.isEmpty()) Yellow else Green) }
        Spacer(Modifier.height(12.dp))
        if (news.isEmpty()) EmptyCard("News feeds unavailable") else news.take(14).forEachIndexed { i, item -> NewsCard(item); if (i != news.take(14).lastIndex) Spacer(Modifier.height(8.dp)) }
    }
}

@Composable
private fun NewsCard(item: NewsItem) {
    val accent = when (item.sentiment) { "POSITIVE" -> Green; "NEGATIVE" -> Red; else -> Cyan }
    Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(13.dp)).background(accent.copy(.06f)).border(1.dp, accent.copy(.15f), RoundedCornerShape(13.dp)).padding(11.dp)) { Row(verticalAlignment = Alignment.CenterVertically) { Text(item.tickerHint, color = accent, fontSize = 8.sp, fontWeight = FontWeight.Black); Spacer(Modifier.weight(1f)); Text(item.sentiment, color = accent, fontSize = 8.sp, fontWeight = FontWeight.Black) }; Spacer(Modifier.height(6.dp)); Text(item.title, color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.Bold, maxLines = 3, overflow = TextOverflow.Ellipsis); Spacer(Modifier.height(5.dp)); Text(item.source, color = TextMuted, fontSize = 8.sp) }
}

@Composable
private fun DepthCard(accent: Color, modifier: Modifier = Modifier, corner: Dp = 18.dp, content: @Composable ColumnScope.() -> Unit) {
    val shape = RoundedCornerShape(corner)
    Column(modifier.fillMaxWidth().shadow(12.dp, shape, ambientColor = accent.copy(.18f), spotColor = accent.copy(.24f)).clip(shape).background(Brush.linearGradient(listOf(accent.copy(.13f), Panel2, Color(0xFF07101C)))).border(1.dp, Brush.linearGradient(listOf(accent.copy(.55f), Color.White.copy(.06f), accent.copy(.18f))), shape).padding(14.dp), content = content)
}

@Composable
private fun RemoteLogo(domain: String, size: Dp) {
    Box(Modifier.size(size).shadow(7.dp, RoundedCornerShape(10.dp)).clip(RoundedCornerShape(10.dp)).background(Color.White).padding(5.dp), contentAlignment = Alignment.Center) {
        AsyncImage(model = "https://www.google.com/s2/favicons?domain=$domain&sz=128", contentDescription = domain, modifier = Modifier.fillMaxSize(), contentScale = ContentScale.Fit)
    }
}

@Composable
private fun StockLogo(symbol: String, size: Dp) { val domain = stockDomain(symbol); if (domain != null) RemoteLogo(domain, size) else SymbolBadge(symbol, size) }

private fun stockDomain(symbol: String): String? = mapOf(
    "ADANIENT.NS" to "adanienterprises.com", "ADANIPORTS.NS" to "adaniports.com", "APOLLOHOSP.NS" to "apollohospitals.com", "ASIANPAINT.NS" to "asianpaints.com", "AXISBANK.NS" to "axisbank.com", "BAJAJ-AUTO.NS" to "bajajauto.com", "BAJFINANCE.NS" to "bajajfinserv.in", "BAJAJFINSV.NS" to "bajajfinserv.in", "BEL.NS" to "bel-india.in", "BHARTIARTL.NS" to "airtel.in", "CIPLA.NS" to "cipla.com", "COALINDIA.NS" to "coalindia.in", "DRREDDY.NS" to "drreddys.com", "EICHERMOT.NS" to "eichermotors.com", "ETERNAL.NS" to "eternal.com", "GRASIM.NS" to "grasim.com", "HCLTECH.NS" to "hcltech.com", "HDFCBANK.NS" to "hdfcbank.com", "HDFCLIFE.NS" to "hdfclife.com", "HEROMOTOCO.NS" to "heromotocorp.com", "HINDALCO.NS" to "hindalco.com", "HINDUNILVR.NS" to "hul.co.in", "ICICIBANK.NS" to "icicibank.com", "INDUSINDBK.NS" to "indusind.com", "INFY.NS" to "infosys.com", "ITC.NS" to "itcportal.com", "JIOFIN.NS" to "jfs.in", "JSWSTEEL.NS" to "jsw.in", "KOTAKBANK.NS" to "kotak.com", "LT.NS" to "larsentoubro.com", "M&M.NS" to "mahindra.com", "MARUTI.NS" to "marutisuzuki.com", "NESTLEIND.NS" to "nestle.in", "NTPC.NS" to "ntpc.co.in", "ONGC.NS" to "ongcindia.com", "POWERGRID.NS" to "powergrid.in", "RELIANCE.NS" to "ril.com", "SBILIFE.NS" to "sbilife.co.in", "SBIN.NS" to "sbi.co.in", "SHRIRAMFIN.NS" to "shriramfinance.in", "SUNPHARMA.NS" to "sunpharma.com", "TATACONSUM.NS" to "tataconsumer.com", "TATAMOTORS.NS" to "tatamotors.com", "TATASTEEL.NS" to "tatasteel.com", "TCS.NS" to "tcs.com", "TECHM.NS" to "techmahindra.com", "TITAN.NS" to "titancompany.in", "TRENT.NS" to "tatatrent.com", "ULTRACEMCO.NS" to "ultratechcement.com", "WIPRO.NS" to "wipro.com"
)[symbol]

@Composable
private fun SymbolBadge(symbol: String, size: Dp) { val clean = symbol.removeSuffix(".NS").removePrefix("^").take(3); Box(Modifier.size(size).clip(RoundedCornerShape(10.dp)).background(Cyan.copy(.13f)).border(1.dp, Cyan.copy(.28f), RoundedCornerShape(10.dp)), contentAlignment = Alignment.Center) { Text(clean, color = Color.White, fontSize = 9.sp, fontWeight = FontWeight.Black) } }

@Composable
private fun Sparkline(values: List<Double>, color: Color, modifier: Modifier = Modifier) {
    Canvas(modifier) { if (values.size < 2) return@Canvas; val minV = values.minOrNull() ?: return@Canvas; val maxV = values.maxOrNull() ?: return@Canvas; val span = (maxV - minV).takeIf { it > 0 } ?: 1.0; val step = size.width / (values.size - 1); values.zipWithNext().forEachIndexed { i, pair -> val y1 = size.height - ((pair.first - minV) / span * size.height * .76f).toFloat() - size.height * .12f; val y2 = size.height - ((pair.second - minV) / span * size.height * .76f).toFloat() - size.height * .12f; drawLine(color.copy(.92f), Offset(i * step, y1), Offset((i + 1) * step, y2), 3f, StrokeCap.Round) }; drawLine(color.copy(.10f), Offset(0f, size.height * .5f), Offset(size.width, size.height * .5f), 1f) }
}

@Composable
private fun DonutGauge(value: Double, color: Color) { Box(Modifier.size(74.dp), contentAlignment = Alignment.Center) { Canvas(Modifier.fillMaxSize()) { val width = 9.dp.toPx(); drawArc(Color.White.copy(.07f), -90f, 360f, false, style = Stroke(width, cap = StrokeCap.Round)); drawArc(color, -90f, (360f * value).toFloat(), false, style = Stroke(width, cap = StrokeCap.Round)) }; Text("${(value * 100).toInt()}%", color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.Black) } }

@Composable
private fun ProgressBar(value: Float, color: Color) { Box(Modifier.fillMaxWidth().height(7.dp).clip(CircleShape).background(Color.White.copy(.06f))) { Box(Modifier.fillMaxWidth(value.coerceIn(0f, 1f)).fillMaxHeight().clip(CircleShape).background(Brush.horizontalGradient(listOf(color.copy(.5f), color)))) } }

@Composable
private fun StatusPill(text: String, color: Color) { Box(Modifier.clip(RoundedCornerShape(20.dp)).background(color.copy(.09f)).border(1.dp, color.copy(.28f), RoundedCornerShape(20.dp)).padding(horizontal = 10.dp, vertical = 6.dp)) { Text(text, color = color, fontSize = 8.sp, fontWeight = FontWeight.Black) } }

@Composable
private fun StatusCard(title: String, detail: String, accent: Color) { Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(accent.copy(.06f)).border(1.dp, accent.copy(.16f), RoundedCornerShape(12.dp)).padding(11.dp), verticalAlignment = Alignment.CenterVertically) { Box(Modifier.size(7.dp).clip(CircleShape).background(accent)); Spacer(Modifier.width(8.dp)); Text(title, color = Color.White, fontSize = 10.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f)); Text(detail, color = accent, fontSize = 8.sp, fontWeight = FontWeight.Bold) } }

@Composable
private fun EmptyCard(text: String) { Box(Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(Color.White.copy(.035f)).border(1.dp, Color.White.copy(.06f), RoundedCornerShape(12.dp)).padding(13.dp)) { Text(text, color = TextMuted, fontSize = 10.sp) } }

@Composable
private fun SourceFooter() { Row(Modifier.fillMaxWidth().padding(vertical = 5.dp), verticalAlignment = Alignment.CenterVertically) { Text("NSTOX ALPHA", color = Cyan, fontSize = 8.sp, fontWeight = FontWeight.Black); Spacer(Modifier.weight(1f)); Text("YAHOO • PUBLIC FEEDS", color = TextMuted, fontSize = 7.sp) } }

private fun signColor(v: Double) = if (v >= 0) Green else Red
private fun formatPct(v: Double) = String.format(Locale.US, "%+.2f%%", v)
private fun formatPrice(v: Double) = if (v <= 0) "—" else String.format(Locale.US, "%,.2f", v)
private fun formatCrore(v: Double) = String.format(Locale.US, "%+,.0f Cr", v)
private fun formatVolume(v: Long): String = when { v >= 10_000_000 -> String.format(Locale.US, "%.1fCr", v / 10_000_000.0); v >= 100_000 -> String.format(Locale.US, "%.1fL", v / 100_000.0); v >= 1_000 -> String.format(Locale.US, "%.1fK", v / 1_000.0); else -> v.toString() }
