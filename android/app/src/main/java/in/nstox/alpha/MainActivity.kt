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
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import java.util.Locale
import kotlin.math.max

private val Bg = Color(0xFF040812)
private val Panel = Color(0xFF09101D)
private val Panel2 = Color(0xFF0C1425)
private val Cyan = Color(0xFF38F7FF)
private val Pink = Color(0xFFFF3D9A)
private val Yellow = Color(0xFFFFC83D)
private val Green = Color(0xFF49F59B)
private val Red = Color(0xFFFF5470)
private val Violet = Color(0xFF9D66FF)
private val TextMuted = Color(0xFF8A98AD)
private val TextSoft = Color(0xFFC8D2E2)

data class DashboardSection(val title: String, val subtitle: String, val icon: String)
data class GlobalSpec(val symbol: String, val name: String, val flag: String)
data class CommoditySpec(val symbol: String, val name: String, val icon: String)

private val globalSpecs = listOf(
    GlobalSpec("NIFTY=F", "GIFT Nifty", "🇮🇳"),
    GlobalSpec("^IXIC", "NASDAQ", "🇺🇸"),
    GlobalSpec("^DJI", "Dow Jones", "🇺🇸"),
    GlobalSpec("^GSPC", "S&P 500", "🇺🇸"),
    GlobalSpec("^GDAXI", "DAX", "🇩🇪"),
    GlobalSpec("^FTSE", "FTSE 100", "🇬🇧"),
    GlobalSpec("^HSI", "Hang Seng", "🇭🇰"),
    GlobalSpec("^N225", "Nikkei 225", "🇯🇵"),
    GlobalSpec("^TWII", "Taiwan", "🇹🇼"),
    GlobalSpec("^AXJO", "ASX 200", "🇦🇺"),
    GlobalSpec("^FCHI", "CAC 40", "🇫🇷"),
    GlobalSpec("IMOEX.ME", "Russia MOEX", "🇷🇺")
)

private val commoditySpecs = listOf(
    CommoditySpec("CL=F", "Crude Oil", "🛢"),
    CommoditySpec("BZ=F", "Brent Oil", "◉"),
    CommoditySpec("GC=F", "Gold", "◆"),
    CommoditySpec("SI=F", "Silver", "◇"),
    CommoditySpec("HG=F", "Copper", "⬡"),
    CommoditySpec("NG=F", "Natural Gas", "♨")
)

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { NstoxApp() }
    }
}

@Composable
fun NstoxApp() {
    val sections = remember {
        listOf(
            DashboardSection("Global Indices", "World market command center", "◎"),
            DashboardSection("Indian Indices", "NIFTY • BANK NIFTY • SENSEX", "◆"),
            DashboardSection("Commodities", "Energy • Metals", "◈"),
            DashboardSection("Top Movers", "Gainers • Losers • Breadth", "↕"),
            DashboardSection("FII & DII", "Institutional cash flow", "₹"),
            DashboardSection("Block & Bulk", "Large reported deals", "▦"),
            DashboardSection("Volume Shockers", "Current vs 20D average", "▥"),
            DashboardSection("52W Breakouts", "Near yearly highs", "△"),
            DashboardSection("AI News", "Source-ranked intelligence", "✦")
        )
    }
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
        Box(
            Modifier.fillMaxSize().background(
                Brush.verticalGradient(listOf(Color(0xFF06101E), Bg, Color(0xFF02050B)))
            )
        ) {
            Scaffold(
                containerColor = Color.Transparent,
                bottomBar = { BottomNav(selected) { selected = it } }
            ) { padding ->
                Column(
                    Modifier.fillMaxSize().padding(padding).padding(horizontal = 14.dp)
                ) {
                    Spacer(Modifier.height(10.dp))
                    BrandHeader(sections[selected].title, snapshot, loading)
                    Spacer(Modifier.height(10.dp))
                    DashboardTabs(sections, selected) { selected = it }
                    Spacer(Modifier.height(10.dp))
                    DashboardBody(sections[selected], selected, snapshot, loading)
                }
            }
        }
    }
}

@Composable
private fun BottomNav(selected: Int, onSelect: (Int) -> Unit) {
    val destinations = listOf(0, 4, 6, 8)
    NavigationBar(containerColor = Color(0xEE070C16), tonalElevation = 0.dp) {
        listOf("Markets", "Flows", "Scanner", "AI").forEachIndexed { i, label ->
            val active = when (i) {
                0 -> selected in 0..3
                1 -> selected in 4..5
                2 -> selected in 6..7
                else -> selected == 8
            }
            NavigationBarItem(
                selected = active,
                onClick = { onSelect(destinations[i]) },
                colors = NavigationBarItemDefaults.colors(
                    selectedIconColor = Cyan,
                    selectedTextColor = Cyan,
                    indicatorColor = Cyan.copy(alpha = 0.10f),
                    unselectedIconColor = TextMuted,
                    unselectedTextColor = TextMuted
                ),
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
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(7.dp).clip(CircleShape).background(if (snapshot.error == null) Green else Red))
                Spacer(Modifier.width(6.dp))
                Text(screen.uppercase(), color = Cyan, fontWeight = FontWeight.Bold, fontSize = 10.sp)
            }
        }
        Column(horizontalAlignment = Alignment.End) {
            Surface(
                color = Color(0xFF111B2E),
                shape = RoundedCornerShape(18.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, Cyan.copy(alpha = .25f))
            ) {
                Text(
                    if (loading) "SYNCING" else "AUTO 15M",
                    color = if (loading) Yellow else Green,
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 7.dp),
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Black
                )
            }
            Spacer(Modifier.height(3.dp))
            Text("${snapshot.updatedAt} • YAHOO", color = TextMuted, fontSize = 8.sp)
        }
    }
}

@Composable
private fun DashboardTabs(sections: List<DashboardSection>, selected: Int, onSelect: (Int) -> Unit) {
    LazyRow(horizontalArrangement = Arrangement.spacedBy(7.dp)) {
        itemsIndexed(sections) { index, item ->
            val active = selected == index
            Box(
                Modifier.clip(RoundedCornerShape(13.dp))
                    .background(if (active) Brush.horizontalGradient(listOf(Pink.copy(.24f), Cyan.copy(.20f))) else Brush.horizontalGradient(listOf(Panel2, Panel2)))
                    .border(1.dp, if (active) Cyan.copy(.45f) else Color.White.copy(.06f), RoundedCornerShape(13.dp))
                    .padding(horizontal = 11.dp, vertical = 9.dp)
            ) {
                Text(
                    "${item.icon} ${item.title}",
                    color = if (active) Color.White else TextMuted,
                    fontSize = 10.sp,
                    fontWeight = if (active) FontWeight.Bold else FontWeight.Medium,
                    modifier = Modifier.noRippleClickable { onSelect(index) }
                )
            }
        }
    }
}

private fun Modifier.noRippleClickable(onClick: () -> Unit): Modifier =
    this.then(androidx.compose.foundation.clickable(onClick = onClick))

@Composable
private fun DashboardBody(section: DashboardSection, index: Int, snapshot: MarketSnapshot, loading: Boolean) {
    val indian = snapshot.indices.filter { it.symbol in setOf("^NSEI", "^NSEBANK", "^BSESN") }
    val gainers = snapshot.stocks.sortedByDescending { it.changePct }.take(7)
    val losers = snapshot.stocks.sortedBy { it.changePct }.take(7)
    val volume = snapshot.stocks.filter { it.volumeRatio > 0 }.sortedByDescending { it.volumeRatio }.take(10)
    val breakouts = snapshot.stocks.filter { it.distanceToHighPct >= -0.5 }.sortedBy { it.distanceToHighPct }.take(10)

    LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp), contentPadding = PaddingValues(bottom = 22.dp)) {
        when (index) {
            0 -> {
                item { GlobalHeaderCard(loading) }
                item { SectionTitle("GLOBAL INDICES", "12 major markets • country flags • 2-column grid") }
                item { GlobalGrid(snapshot.indices) }
            }
            1 -> {
                item { MarketHero(section, snapshot, loading) }
                item { BreadthStrip(snapshot) }
                item { SectionTitle("INDIA MARKET CORE", "NIFTY • BANK NIFTY • SENSEX") }
                items(indian) { NeonQuoteCard(it, Yellow) }
                item { SectorBreadthPanel(snapshot.stocks) }
            }
            2 -> {
                item { CommodityHeaderCard(loading) }
                item { SectionTitle("COMMODITIES", "Energy and metals • 2 columns × 3 rows") }
                item { CommodityGrid(snapshot.commodities) }
            }
            3 -> {
                item { MarketHero(section, snapshot, loading) }
                item { BreadthStrip(snapshot) }
                item { SectionTitle("TOP GAINERS", "NIFTY 50 universe") }
                items(gainers) { CompactMoverRow(it, true) }
                item { SectionTitle("TOP LOSERS", "NIFTY 50 universe") }
                items(losers) { CompactMoverRow(it, false) }
            }
            4 -> item { InstitutionalPanel() }
            5 -> item { DealsPanel() }
            6 -> {
                item { MarketHero(section, snapshot, loading) }
                item { SectionTitle("VOLUME SHOCKERS", "Current volume ÷ 20-session average") }
                items(volume) { VolumeRow(it) }
            }
            7 -> {
                item { MarketHero(section, snapshot, loading) }
                item { SectionTitle("52-WEEK PROXIMITY", "Closest names to computed 1Y highs") }
                items(breakouts) { BreakoutRow(it) }
            }
            else -> item { AiNewsPanel() }
        }

        snapshot.error?.let { item { StatusCard("DATA FEED", it, Red) } }
        item { SourceFooter() }
    }
}

@Composable
private fun GlobalHeaderCard(loading: Boolean) {
    NeonPanel(Cyan) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text("◎", color = Yellow, fontSize = 25.sp)
                Text("WORLD MARKET WALL", color = Color.White, fontSize = 21.sp, fontWeight = FontWeight.Black)
                Text("US • Europe • Asia • India futures", color = TextMuted, fontSize = 10.sp)
            }
            StatusPill(if (loading) "SYNC" else "LIVE GRID", if (loading) Yellow else Green)
        }
    }
}

@Composable
private fun CommodityHeaderCard(loading: Boolean) {
    NeonPanel(Yellow) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text("◈", color = Pink, fontSize = 25.sp)
                Text("COMMODITY DESK", color = Color.White, fontSize = 21.sp, fontWeight = FontWeight.Black)
                Text("Oil • Bullion • Base metals • Gas", color = TextMuted, fontSize = 10.sp)
            }
            StatusPill(if (loading) "SYNC" else "AUTO 15M", if (loading) Yellow else Green)
        }
    }
}

@Composable
private fun GlobalGrid(quotes: List<MarketQuote>) {
    Column(verticalArrangement = Arrangement.spacedBy(9.dp)) {
        globalSpecs.chunked(2).forEach { rowSpecs ->
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(9.dp)) {
                rowSpecs.forEach { spec ->
                    val quote = quotes.firstOrNull { it.symbol == spec.symbol }
                    GlobalMarketCard(spec, quote, Modifier.weight(1f))
                }
                if (rowSpecs.size == 1) Spacer(Modifier.weight(1f))
            }
        }
    }
}

@Composable
private fun GlobalMarketCard(spec: GlobalSpec, q: MarketQuote?, modifier: Modifier = Modifier) {
    val change = q?.changePct ?: 0.0
    val accent = if (q == null) TextMuted else signColor(change)
    Column(
        modifier.height(137.dp).clip(RoundedCornerShape(18.dp))
            .background(Brush.linearGradient(listOf(accent.copy(.12f), Panel2, Panel)))
            .border(1.dp, accent.copy(.24f), RoundedCornerShape(18.dp))
            .padding(11.dp)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(spec.flag, fontSize = 22.sp)
            Spacer(Modifier.width(7.dp))
            Column(Modifier.weight(1f)) {
                Text(spec.name, color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.Black, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(spec.symbol, color = TextMuted, fontSize = 7.sp)
            }
        }
        Spacer(Modifier.height(8.dp))
        Text(q?.let { formatPrice(it.price) } ?: "—", color = Color.White, fontSize = 17.sp, fontWeight = FontWeight.Black)
        Text(q?.let { formatPct(it.changePct) } ?: "FEED WAIT", color = if (q == null) TextMuted else accent, fontSize = 9.sp, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(5.dp))
        Sparkline(q?.history ?: emptyList(), accent, Modifier.fillMaxWidth().height(32.dp))
    }
}

@Composable
private fun CommodityGrid(quotes: List<MarketQuote>) {
    Column(verticalArrangement = Arrangement.spacedBy(9.dp)) {
        commoditySpecs.chunked(2).forEach { rowSpecs ->
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(9.dp)) {
                rowSpecs.forEach { spec ->
                    val quote = quotes.firstOrNull { it.symbol == spec.symbol }
                    CommodityCard(spec, quote, Modifier.weight(1f))
                }
            }
        }
    }
}

@Composable
private fun CommodityCard(spec: CommoditySpec, q: MarketQuote?, modifier: Modifier = Modifier) {
    val change = q?.changePct ?: 0.0
    val accent = when (spec.symbol) {
        "GC=F" -> Yellow
        "SI=F" -> Cyan
        "HG=F" -> Pink
        "NG=F" -> Violet
        else -> if (q == null) TextMuted else signColor(change)
    }
    Column(
        modifier.height(148.dp).clip(RoundedCornerShape(18.dp))
            .background(Brush.linearGradient(listOf(accent.copy(.13f), Panel2, Panel)))
            .border(1.dp, accent.copy(.27f), RoundedCornerShape(18.dp))
            .padding(12.dp)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                Modifier.size(36.dp).clip(RoundedCornerShape(11.dp))
                    .background(accent.copy(.16f)).border(1.dp, accent.copy(.35f), RoundedCornerShape(11.dp)),
                contentAlignment = Alignment.Center
            ) { Text(spec.icon, color = accent, fontSize = 17.sp, fontWeight = FontWeight.Black) }
            Spacer(Modifier.width(8.dp))
            Column(Modifier.weight(1f)) {
                Text(spec.name, color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.Black, maxLines = 1)
                Text(spec.symbol, color = TextMuted, fontSize = 7.sp)
            }
        }
        Spacer(Modifier.height(8.dp))
        Text(q?.let { formatPrice(it.price) } ?: "—", color = Color.White, fontSize = 18.sp, fontWeight = FontWeight.Black)
        Text(q?.let { formatPct(it.changePct) } ?: "FEED WAIT", color = if (q == null) TextMuted else signColor(change), fontSize = 9.sp, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(5.dp))
        Sparkline(q?.history ?: emptyList(), accent, Modifier.fillMaxWidth().height(31.dp))
    }
}

@Composable
private fun StatusPill(text: String, color: Color) {
    Box(
        Modifier.clip(RoundedCornerShape(20.dp)).background(color.copy(.10f))
            .border(1.dp, color.copy(.30f), RoundedCornerShape(20.dp)).padding(horizontal = 10.dp, vertical = 7.dp)
    ) { Text(text, color = color, fontSize = 9.sp, fontWeight = FontWeight.Black) }
}

@Composable
private fun MarketHero(section: DashboardSection, snapshot: MarketSnapshot, loading: Boolean) {
    val lead = snapshot.indices.firstOrNull { it.symbol == "^NSEI" } ?: snapshot.indices.firstOrNull()
    NeonPanel(Pink) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(section.icon, color = Yellow, fontSize = 25.sp)
                Text(section.title, color = Color.White, fontSize = 22.sp, fontWeight = FontWeight.Black)
                Text(section.subtitle, color = TextMuted, fontSize = 11.sp)
            }
            if (lead != null) DonutGauge(((lead.changePct + 3.0) / 6.0).coerceIn(0.0, 1.0), "PULSE")
        }
        Spacer(Modifier.height(14.dp))
        if (lead != null) {
            Row(verticalAlignment = Alignment.Bottom) {
                Column(Modifier.weight(.40f)) {
                    Text(lead.name.uppercase(), color = TextMuted, fontSize = 9.sp, fontWeight = FontWeight.Bold)
                    Text(formatPrice(lead.price), color = Color.White, fontSize = 27.sp, fontWeight = FontWeight.Black)
                    Text(formatPct(lead.changePct), color = signColor(lead.changePct), fontWeight = FontWeight.Bold, fontSize = 12.sp)
                }
                Sparkline(lead.history, signColor(lead.changePct), Modifier.weight(.60f).height(72.dp))
            }
        } else Text(if (loading) "Building live market snapshot…" else "Waiting for market feed", color = TextSoft, fontSize = 13.sp)
    }
}

@Composable
private fun BreadthStrip(snapshot: MarketSnapshot) {
    val total = max(snapshot.stocks.size, 1)
    val up = snapshot.stocks.count { it.changePct > 0 }
    val down = snapshot.stocks.count { it.changePct < 0 }
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        MetricTile("ADVANCE", "$up", "${(up * 100f / total).toInt()}%", Green, Modifier.weight(1f))
        MetricTile("DECLINE", "$down", "${(down * 100f / total).toInt()}%", Red, Modifier.weight(1f))
        MetricTile("COVERAGE", "${snapshot.stocks.size}", "NIFTY50", Cyan, Modifier.weight(1f))
    }
}

@Composable
private fun MetricTile(label: String, value: String, sub: String, accent: Color, modifier: Modifier = Modifier) {
    Box(modifier.clip(RoundedCornerShape(17.dp)).background(Brush.verticalGradient(listOf(accent.copy(.10f), Panel))).border(1.dp, accent.copy(.22f), RoundedCornerShape(17.dp)).padding(12.dp)) {
        Column {
            Text(label, color = TextMuted, fontSize = 8.sp, fontWeight = FontWeight.Bold)
            Text(value, color = accent, fontSize = 19.sp, fontWeight = FontWeight.Black)
            Text(sub, color = TextSoft, fontSize = 8.sp)
        }
    }
}

@Composable
private fun SectionTitle(title: String, subtitle: String) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.Bottom) {
        Column(Modifier.weight(1f)) {
            Text(title, color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Black, letterSpacing = .7.sp)
            Text(subtitle, color = TextMuted, fontSize = 9.sp)
        }
        Text("NSTOX ALPHA", color = Cyan.copy(.55f), fontSize = 8.sp, fontWeight = FontWeight.Black)
    }
}

@Composable
private fun NeonQuoteCard(q: MarketQuote, accent: Color = Cyan) {
    NeonPanel(accent) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            SymbolBadge(q.symbol, accent)
            Spacer(Modifier.width(10.dp))
            Column(Modifier.weight(.42f)) {
                Text(q.name, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 13.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(q.symbol, color = TextMuted, fontSize = 8.sp)
                Spacer(Modifier.height(3.dp))
                Text(formatPrice(q.price), color = Color.White, fontWeight = FontWeight.Black, fontSize = 18.sp)
                Text(formatPct(q.changePct), color = signColor(q.changePct), fontSize = 10.sp, fontWeight = FontWeight.Bold)
            }
            Sparkline(q.history, signColor(q.changePct), Modifier.weight(.58f).height(58.dp))
        }
    }
}

@Composable
private fun CompactMoverRow(q: MarketQuote, positive: Boolean) {
    val accent = if (positive) Green else Red
    Box(Modifier.fillMaxWidth().clip(RoundedCornerShape(15.dp)).background(Brush.horizontalGradient(listOf(accent.copy(.08f), Panel))).border(1.dp, accent.copy(.18f), RoundedCornerShape(15.dp)).padding(12.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            SymbolBadge(q.symbol, accent, 38.dp)
            Spacer(Modifier.width(10.dp))
            Column(Modifier.weight(1f)) {
                Text(q.name, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                Text(q.symbol.removeSuffix(".NS"), color = TextMuted, fontSize = 8.sp)
            }
            Column(horizontalAlignment = Alignment.End) {
                Text(formatPrice(q.price), color = Color.White, fontWeight = FontWeight.Black, fontSize = 14.sp)
                Text(formatPct(q.changePct), color = accent, fontWeight = FontWeight.Bold, fontSize = 11.sp)
            }
        }
    }
}

@Composable
private fun SectorBreadthPanel(stocks: List<MarketQuote>) {
    val up = stocks.count { it.changePct > 0 }
    val total = max(stocks.size, 1)
    NeonPanel(Violet) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            DonutGauge(up.toDouble() / total, "BREADTH", Violet)
            Spacer(Modifier.width(18.dp))
            Column(Modifier.weight(1f)) {
                Text("MARKET BREADTH", color = Color.White, fontWeight = FontWeight.Black, fontSize = 14.sp)
                Text("$up advancing • ${stocks.count { it.changePct < 0 }} declining", color = TextSoft, fontSize = 10.sp)
                Spacer(Modifier.height(8.dp))
                ProgressBar(up.toFloat() / total, Green)
            }
        }
    }
}

@Composable
private fun VolumeRow(q: MarketQuote) {
    NeonPanel(Yellow) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            SymbolBadge(q.symbol, Yellow, 38.dp)
            Spacer(Modifier.width(10.dp))
            Column(Modifier.weight(1f)) {
                Text(q.name, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                Text("VOL ${formatVolume(q.volume)} • AVG ${formatVolume(q.avgVolume20.toLong())}", color = TextMuted, fontSize = 8.sp)
                Spacer(Modifier.height(6.dp))
                ProgressBar((q.volumeRatio / 4.0).coerceIn(0.0, 1.0).toFloat(), Yellow)
            }
            Spacer(Modifier.width(10.dp))
            Text("${String.format(Locale.US, "%.1f", q.volumeRatio)}×", color = Yellow, fontSize = 18.sp, fontWeight = FontWeight.Black)
        }
    }
}

@Composable
private fun BreakoutRow(q: MarketQuote) {
    val dist = q.distanceToHighPct
    NeonPanel(Pink) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            SymbolBadge(q.symbol, Pink, 38.dp)
            Spacer(Modifier.width(10.dp))
            Column(Modifier.weight(1f)) {
                Text(q.name, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                Text("52W HIGH ${formatPrice(q.yearHigh)}", color = TextMuted, fontSize = 8.sp)
                Spacer(Modifier.height(5.dp))
                ProgressBar((1.0 - dist / 10.0).coerceIn(0.0, 1.0).toFloat(), Pink)
            }
            Spacer(Modifier.width(10.dp))
            Column(horizontalAlignment = Alignment.End) {
                Text(formatPrice(q.price), color = Color.White, fontWeight = FontWeight.Black, fontSize = 14.sp)
                Text("${String.format(Locale.US, "%.2f", dist)}% away", color = if (dist <= 2) Green else Yellow, fontSize = 9.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}

@Composable
private fun InstitutionalPanel() {
    NeonPanel(Pink) {
        Text("FII / DII FLOW DESK", color = Color.White, fontSize = 17.sp, fontWeight = FontWeight.Black)
        Text("Institutional flow is intentionally not fabricated from stock-price APIs.", color = TextSoft, fontSize = 11.sp)
        Spacer(Modifier.height(14.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            MetricTile("FII NET", "—", "EXCHANGE FEED", Pink, Modifier.weight(1f))
            MetricTile("DII NET", "—", "EXCHANGE FEED", Cyan, Modifier.weight(1f))
        }
    }
}

@Composable
private fun DealsPanel() {
    NeonPanel(Yellow) {
        Text("BLOCK & BULK DEAL RADAR", color = Color.White, fontSize = 17.sp, fontWeight = FontWeight.Black)
        Text("Large-deal cards require official exchange disclosures or a licensed redistribution feed.", color = TextSoft, fontSize = 11.sp)
        Spacer(Modifier.height(14.dp))
        StatusCard("BLOCK DEALS", "Waiting for verified exchange connector", Yellow)
        Spacer(Modifier.height(8.dp))
        StatusCard("BULK DEALS", "Waiting for verified exchange connector", Pink)
    }
}

@Composable
private fun AiNewsPanel() {
    NeonPanel(Violet) {
        Text("AI MARKET INTELLIGENCE", color = Color.White, fontSize = 18.sp, fontWeight = FontWeight.Black)
        Text("Agentic pipeline prepared for source ingestion, clustering, ticker mapping, credibility scoring and short-form summaries.", color = TextSoft, fontSize = 11.sp)
        Spacer(Modifier.height(14.dp))
        listOf(
            Triple("OFFICIAL FILINGS", "HIGH TRUST", Green),
            Triple("NEWS FEEDS", "SOURCE RANKED", Cyan),
            Triple("SOCIAL PULSE", "VERIFY FIRST", Yellow),
            Triple("RUMOUR FILTER", "UNVERIFIED", Pink)
        ).forEach { (name, state, color) ->
            StatusCard(name, state, color)
            Spacer(Modifier.height(7.dp))
        }
    }
}

@Composable
private fun StatusCard(title: String, detail: String, accent: Color) {
    Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(13.dp)).background(accent.copy(.07f)).border(1.dp, accent.copy(.16f), RoundedCornerShape(13.dp)).padding(11.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(8.dp).clip(CircleShape).background(accent))
        Spacer(Modifier.width(9.dp))
        Text(title, color = Color.White, fontSize = 10.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
        Text(detail, color = accent, fontSize = 8.sp, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun NeonPanel(accent: Color, content: @Composable ColumnScope.() -> Unit) {
    Column(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(20.dp))
            .background(Brush.linearGradient(listOf(accent.copy(alpha = .10f), Panel2, Panel)))
            .border(1.dp, accent.copy(alpha = .22f), RoundedCornerShape(20.dp)).padding(15.dp),
        content = content
    )
}

@Composable
private fun SymbolBadge(symbol: String, accent: Color, size: androidx.compose.ui.unit.Dp = 44.dp) {
    val clean = symbol.removePrefix("^").removeSuffix(".NS").take(3)
    Box(
        Modifier.size(size).clip(RoundedCornerShape(13.dp))
            .background(Brush.linearGradient(listOf(accent.copy(.30f), Color(0xFF10192A))))
            .border(1.dp, accent.copy(.42f), RoundedCornerShape(13.dp)),
        contentAlignment = Alignment.Center
    ) { Text(clean, color = Color.White, fontSize = if (clean.length > 2) 9.sp else 11.sp, fontWeight = FontWeight.Black) }
}

@Composable
private fun Sparkline(values: List<Double>, color: Color, modifier: Modifier = Modifier) {
    Canvas(modifier) {
        if (values.size < 2) return@Canvas
        val minV = values.minOrNull() ?: return@Canvas
        val maxV = values.maxOrNull() ?: return@Canvas
        val span = (maxV - minV).takeIf { it > 0 } ?: 1.0
        val step = size.width / (values.size - 1)
        values.zipWithNext().forEachIndexed { i, pair ->
            val y1 = size.height - ((pair.first - minV) / span * size.height * .78f).toFloat() - size.height * .11f
            val y2 = size.height - ((pair.second - minV) / span * size.height * .78f).toFloat() - size.height * .11f
            drawLine(color.copy(alpha = .90f), Offset(i * step, y1), Offset((i + 1) * step, y2), 3f, cap = StrokeCap.Round)
        }
        drawLine(color.copy(.12f), Offset(0f, size.height * .5f), Offset(size.width, size.height * .5f), 1f)
    }
}

@Composable
private fun DonutGauge(value: Double, label: String, color: Color = Pink) {
    Box(Modifier.size(76.dp), contentAlignment = Alignment.Center) {
        Canvas(Modifier.fillMaxSize()) {
            val width = 9.dp.toPx()
            drawArc(Color.White.copy(.07f), -90f, 360f, false, style = Stroke(width, cap = StrokeCap.Round))
            drawArc(color, -90f, (360f * value).toFloat(), false, style = Stroke(width, cap = StrokeCap.Round))
        }
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text("${(value * 100).toInt()}%", color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.Black)
            Text(label, color = TextMuted, fontSize = 7.sp, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
private fun ProgressBar(value: Float, color: Color) {
    Box(Modifier.fillMaxWidth().height(7.dp).clip(CircleShape).background(Color.White.copy(.06f))) {
        Box(Modifier.fillMaxWidth(value.coerceIn(0f, 1f)).fillMaxHeight().clip(CircleShape).background(Brush.horizontalGradient(listOf(color.copy(.55f), color))))
    }
}

@Composable
private fun SourceFooter() {
    Box(Modifier.fillMaxWidth().clip(RoundedCornerShape(15.dp)).background(Color(0xAA060B13)).border(1.dp, Color.White.copy(.06f), RoundedCornerShape(15.dp)).padding(12.dp)) {
        Column {
            Text("NSTOX ALPHA • SCREENSHOT MODE", color = Cyan, fontSize = 9.sp, fontWeight = FontWeight.Black)
            Text("Auto prices use Yahoo Finance chart endpoints. If GIFT Nifty is unavailable from Yahoo, its card remains blank rather than substituting NIFTY 50. Verify exchange-sensitive data before publishing or trading.", color = TextMuted, fontSize = 8.sp)
        }
    }
}

private fun signColor(v: Double) = if (v >= 0) Green else Red
private fun formatPct(v: Double) = String.format(Locale.US, "%+.2f%%", v)
private fun formatPrice(v: Double) = if (v <= 0) "—" else String.format(Locale.US, "%,.2f", v)
private fun formatVolume(v: Long): String = when {
    v >= 10_000_000 -> String.format(Locale.US, "%.1fCr", v / 10_000_000.0)
    v >= 100_000 -> String.format(Locale.US, "%.1fL", v / 100_000.0)
    v >= 1_000 -> String.format(Locale.US, "%.1fK", v / 1_000.0)
    else -> v.toString()
}
