package com.nstox.alpha

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import java.util.Locale
import kotlin.math.max

private val V4Bg = Color(0xFF040812)
private val V4Panel = Color(0xFF09101D)
private val V4Panel2 = Color(0xFF0C1425)
private val V4Cyan = Color(0xFF38F7FF)
private val V4Pink = Color(0xFFFF3D9A)
private val V4Yellow = Color(0xFFFFC83D)
private val V4Green = Color(0xFF49F59B)
private val V4Red = Color(0xFFFF5470)
private val V4Violet = Color(0xFF9D66FF)
private val V4Muted = Color(0xFF8A98AD)
private val V4Soft = Color(0xFFC8D2E2)

data class V4Section(val title: String, val subtitle: String, val icon: String)
data class V4Global(val symbol: String, val name: String, val flag: String)
data class V4Commodity(val symbol: String, val name: String, val icon: String)

private val v4Globals = listOf(
    V4Global("NIFTY=F", "GIFT Nifty", "🇮🇳"), V4Global("^IXIC", "NASDAQ", "🇺🇸"),
    V4Global("^DJI", "Dow Jones", "🇺🇸"), V4Global("^GSPC", "S&P 500", "🇺🇸"),
    V4Global("^GDAXI", "DAX", "🇩🇪"), V4Global("^FTSE", "FTSE 100", "🇬🇧"),
    V4Global("^HSI", "Hang Seng", "🇭🇰"), V4Global("^N225", "Nikkei 225", "🇯🇵"),
    V4Global("^TWII", "Taiwan", "🇹🇼"), V4Global("^AXJO", "ASX 200", "🇦🇺"),
    V4Global("^FCHI", "CAC 40", "🇫🇷"), V4Global("IMOEX.ME", "Russia MOEX", "🇷🇺")
)

private val v4Commodities = listOf(
    V4Commodity("CL=F", "Crude Oil", "🛢"), V4Commodity("BZ=F", "Brent Oil", "◉"),
    V4Commodity("GC=F", "Gold", "◆"), V4Commodity("SI=F", "Silver", "◇"),
    V4Commodity("HG=F", "Copper", "⬡"), V4Commodity("NG=F", "Natural Gas", "♨")
)

class DashboardActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { V4App() }
    }
}

@Composable
private fun V4App() {
    val sections = remember {
        listOf(
            V4Section("Global Indices", "1-day world market pulse", "◎"),
            V4Section("Indian Indices", "1-day NIFTY • BANK NIFTY • SENSEX", "◆"),
            V4Section("Commodities", "1-day energy • metals", "◈"),
            V4Section("Top Movers", "1-day stock changes", "↕"),
            V4Section("FII & DII", "Automatic institutional flow", "₹"),
            V4Section("Block & Bulk", "Large reported deals", "▦"),
            V4Section("Volume Shockers", "Current-day volume activity", "▥"),
            V4Section("52W Breakouts", "Price vs 52-week high", "△"),
            V4Section("AI News", "Automatic multi-source news", "✦")
        )
    }
    var selected by remember { mutableIntStateOf(0) }
    var snap by remember { mutableStateOf(MarketSnapshot()) }
    var loading by remember { mutableStateOf(true) }

    LaunchedEffect(Unit) {
        while (true) {
            loading = true
            snap = MarketRepository.loadSnapshot()
            loading = false
            delay(15 * 60 * 1000L)
        }
    }

    MaterialTheme(colorScheme = darkColorScheme(background = V4Bg, surface = V4Panel, primary = V4Cyan, secondary = V4Pink)) {
        Scaffold(
            containerColor = Color.Transparent,
            bottomBar = { V4BottomNav(selected) { selected = it } },
            modifier = Modifier.background(Brush.verticalGradient(listOf(Color(0xFF06101E), V4Bg, Color(0xFF02050B))))
        ) { pad ->
            Column(Modifier.fillMaxSize().padding(pad).padding(horizontal = 14.dp)) {
                Spacer(Modifier.height(10.dp))
                V4Header(sections[selected].title, snap, loading)
                Spacer(Modifier.height(9.dp))
                V4Tabs(sections, selected) { selected = it }
                Spacer(Modifier.height(9.dp))
                V4Body(selected, snap, loading)
            }
        }
    }
}

@Composable
private fun V4BottomNav(selected: Int, onSelect: (Int) -> Unit) {
    val destinations = listOf(0, 4, 6, 8)
    NavigationBar(containerColor = Color(0xEE070C16), tonalElevation = 0.dp) {
        listOf("Markets", "Flows", "Scanner", "AI").forEachIndexed { i, label ->
            val active = when (i) { 0 -> selected in 0..3; 1 -> selected in 4..5; 2 -> selected in 6..7; else -> selected == 8 }
            NavigationBarItem(
                selected = active, onClick = { onSelect(destinations[i]) },
                colors = NavigationBarItemDefaults.colors(selectedIconColor = V4Cyan, selectedTextColor = V4Cyan, indicatorColor = V4Cyan.copy(.10f), unselectedIconColor = V4Muted, unselectedTextColor = V4Muted),
                icon = { Text(listOf("◈", "₹", "⌁", "✦")[i], fontSize = 17.sp) },
                label = { Text(label, fontSize = 9.sp, fontWeight = FontWeight.Bold) }
            )
        }
    }
}

@Composable
private fun V4Header(screen: String, snap: MarketSnapshot, loading: Boolean) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f)) {
            Text("NSTOX ALPHA", color = Color.White, fontWeight = FontWeight.Black, fontSize = 22.sp, letterSpacing = 1.5.sp)
            Text(screen.uppercase(), color = V4Cyan, fontWeight = FontWeight.Bold, fontSize = 10.sp)
        }
        Column(horizontalAlignment = Alignment.End) {
            V4Pill(if (loading) "SYNCING" else "1D • AUTO 15M", if (loading) V4Yellow else V4Green)
            Spacer(Modifier.height(3.dp))
            Text("${snap.updatedAt} • MULTI-SOURCE", color = V4Muted, fontSize = 8.sp)
        }
    }
}

@Composable
private fun V4Tabs(sections: List<V4Section>, selected: Int, onSelect: (Int) -> Unit) {
    LazyRow(horizontalArrangement = Arrangement.spacedBy(7.dp)) {
        itemsIndexed(sections) { i, s ->
            val active = selected == i
            Box(
                Modifier.clip(RoundedCornerShape(13.dp))
                    .background(if (active) Brush.horizontalGradient(listOf(V4Pink.copy(.24f), V4Cyan.copy(.20f))) else Brush.horizontalGradient(listOf(V4Panel2, V4Panel2)))
                    .border(1.dp, if (active) V4Cyan.copy(.45f) else Color.White.copy(.06f), RoundedCornerShape(13.dp))
                    .clickable { onSelect(i) }.padding(horizontal = 11.dp, vertical = 9.dp)
            ) { Text("${s.icon} ${s.title}", color = if (active) Color.White else V4Muted, fontSize = 10.sp, fontWeight = if (active) FontWeight.Bold else FontWeight.Medium) }
        }
    }
}

@Composable
private fun V4Body(index: Int, snap: MarketSnapshot, loading: Boolean) {
    val indian = snap.indices.filter { it.symbol in setOf("^NSEI", "^NSEBANK", "^BSESN") }
    val gainers = snap.stocks.sortedByDescending { it.changePct }.take(8)
    val losers = snap.stocks.sortedBy { it.changePct }.take(8)
    val volume = snap.stocks.filter { it.volumeRatio > 0 }.sortedByDescending { it.volumeRatio }.take(10)
    val breakouts = snap.stocks.filter { it.yearHigh > 0 }.sortedBy { it.distanceToHighPct }.take(10)

    LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp), contentPadding = PaddingValues(bottom = 22.dp)) {
        when (index) {
            0 -> {
                item { V4Hero("WORLD MARKET WALL", "All cards use today's 1-day move and intraday chart", "◎", V4Cyan, loading) }
                item { V4Title("GLOBAL INDICES", "12 markets • country flags • 2-column grid") }
                item { V4GlobalGrid(snap.indices) }
            }
            1 -> {
                item { V4Hero("INDIA MARKET CORE", "Today's move only • 5-minute intraday chart", "◆", V4Yellow, loading) }
                items(indian) { V4QuoteCard(it, V4Yellow) }
            }
            2 -> {
                item { V4Hero("COMMODITY DESK", "Today's move only • energy and metals", "◈", V4Pink, loading) }
                item { V4CommodityGrid(snap.commodities) }
            }
            3 -> {
                item { V4Hero("1-DAY TOP MOVERS", "NIFTY 50 universe ranked by today's percentage move", "↕", V4Cyan, loading) }
                item { V4Title("TOP GAINERS", "1-day change") }
                items(gainers) { V4Mover(it, V4Green) }
                item { V4Title("TOP LOSERS", "1-day change") }
                items(losers) { V4Mover(it, V4Red) }
            }
            4 -> item { V4Institutional(snap.institutional, loading) }
            5 -> item { V4Placeholder("BLOCK & BULK DEAL RADAR", "Official exchange deal connector remains source-gated.", V4Yellow) }
            6 -> {
                item { V4Hero("VOLUME SHOCKERS", "Current-day activity vs available average-volume metadata", "▥", V4Yellow, loading) }
                items(volume) { V4Volume(it) }
            }
            7 -> {
                item { V4Hero("52W BREAKOUT RADAR", "Current 1-day price compared with 52-week high metadata", "△", V4Pink, loading) }
                items(breakouts) { V4Breakout(it) }
            }
            else -> {
                item { V4Hero("AI NEWS INTELLIGENCE", "Automatic RSS ingestion • dedupe • ticker hint • sentiment tag", "✦", V4Violet, loading) }
                if (snap.news.isEmpty()) item { V4Placeholder("NEWS FEED", "Waiting for Google News / Mint RSS feeds", V4Violet) }
                else items(snap.news) { V4NewsCard(it) }
            }
        }
        snap.error?.let { item { V4Placeholder("DATA FEED", it, V4Red) } }
        item { V4Footer() }
    }
}

@Composable
private fun V4Hero(title: String, subtitle: String, icon: String, accent: Color, loading: Boolean) {
    V4PanelBox(accent) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(icon, color = V4Yellow, fontSize = 27.sp)
            Spacer(Modifier.width(11.dp))
            Column(Modifier.weight(1f)) {
                Text(title, color = Color.White, fontSize = 19.sp, fontWeight = FontWeight.Black)
                Text(subtitle, color = V4Muted, fontSize = 10.sp)
            }
            V4Pill(if (loading) "SYNC" else "1 DAY", if (loading) V4Yellow else V4Green)
        }
    }
}

@Composable
private fun V4GlobalGrid(quotes: List<MarketQuote>) {
    Column(verticalArrangement = Arrangement.spacedBy(9.dp)) {
        v4Globals.chunked(2).forEach { specs ->
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(9.dp)) {
                specs.forEach { s -> V4GlobalCard(s, quotes.firstOrNull { it.symbol == s.symbol }, Modifier.weight(1f)) }
            }
        }
    }
}

@Composable
private fun V4GlobalCard(spec: V4Global, q: MarketQuote?, modifier: Modifier = Modifier) {
    val accent = q?.let { v4Sign(it.changePct) } ?: V4Muted
    Column(modifier.height(142.dp).clip(RoundedCornerShape(18.dp)).background(Brush.linearGradient(listOf(accent.copy(.12f), V4Panel2, V4Panel))).border(1.dp, accent.copy(.24f), RoundedCornerShape(18.dp)).padding(11.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(spec.flag, fontSize = 22.sp); Spacer(Modifier.width(7.dp))
            Column(Modifier.weight(1f)) {
                Text(spec.name, color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.Black, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text("1D • ${spec.symbol}", color = V4Muted, fontSize = 7.sp)
            }
        }
        Spacer(Modifier.height(7.dp))
        Text(q?.let { v4Price(it.price) } ?: "—", color = Color.White, fontSize = 17.sp, fontWeight = FontWeight.Black)
        Text(q?.let { v4Pct(it.changePct) } ?: "FEED WAIT", color = accent, fontSize = 9.sp, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(5.dp)); V4Spark(q?.history ?: emptyList(), accent, Modifier.fillMaxWidth().height(34.dp))
    }
}

@Composable
private fun V4CommodityGrid(quotes: List<MarketQuote>) {
    Column(verticalArrangement = Arrangement.spacedBy(9.dp)) {
        v4Commodities.chunked(2).forEach { specs ->
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(9.dp)) {
                specs.forEach { s -> V4CommodityCard(s, quotes.firstOrNull { it.symbol == s.symbol }, Modifier.weight(1f)) }
            }
        }
    }
}

@Composable
private fun V4CommodityCard(spec: V4Commodity, q: MarketQuote?, modifier: Modifier = Modifier) {
    val accent = when (spec.symbol) { "GC=F" -> V4Yellow; "SI=F" -> V4Cyan; "HG=F" -> V4Pink; "NG=F" -> V4Violet; else -> q?.let { v4Sign(it.changePct) } ?: V4Muted }
    Column(modifier.height(147.dp).clip(RoundedCornerShape(18.dp)).background(Brush.linearGradient(listOf(accent.copy(.13f), V4Panel2, V4Panel))).border(1.dp, accent.copy(.27f), RoundedCornerShape(18.dp)).padding(11.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(34.dp).clip(RoundedCornerShape(10.dp)).background(accent.copy(.15f)).border(1.dp, accent.copy(.35f), RoundedCornerShape(10.dp)), contentAlignment = Alignment.Center) { Text(spec.icon, color = accent, fontSize = 16.sp) }
            Spacer(Modifier.width(8.dp)); Column { Text(spec.name, color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.Black); Text("1D • ${spec.symbol}", color = V4Muted, fontSize = 7.sp) }
        }
        Spacer(Modifier.height(7.dp)); Text(q?.let { v4Price(it.price) } ?: "—", color = Color.White, fontSize = 17.sp, fontWeight = FontWeight.Black)
        Text(q?.let { v4Pct(it.changePct) } ?: "FEED WAIT", color = q?.let { v4Sign(it.changePct) } ?: V4Muted, fontSize = 9.sp, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(4.dp)); V4Spark(q?.history ?: emptyList(), accent, Modifier.fillMaxWidth().height(33.dp))
    }
}

@Composable
private fun V4QuoteCard(q: MarketQuote, accent: Color) {
    V4PanelBox(accent) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            V4Badge(q.symbol, accent); Spacer(Modifier.width(10.dp))
            Column(Modifier.weight(.45f)) {
                Text(q.name, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                Text("1-DAY CHANGE", color = V4Muted, fontSize = 8.sp)
                Text(v4Price(q.price), color = Color.White, fontWeight = FontWeight.Black, fontSize = 18.sp)
                Text(v4Pct(q.changePct), color = v4Sign(q.changePct), fontSize = 10.sp, fontWeight = FontWeight.Bold)
            }
            V4Spark(q.history, v4Sign(q.changePct), Modifier.weight(.55f).height(58.dp))
        }
    }
}

@Composable
private fun V4Mover(q: MarketQuote, accent: Color) {
    Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(15.dp)).background(Brush.horizontalGradient(listOf(accent.copy(.08f), V4Panel))).border(1.dp, accent.copy(.18f), RoundedCornerShape(15.dp)).padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
        V4Badge(q.symbol, accent, 38.dp); Spacer(Modifier.width(10.dp))
        Column(Modifier.weight(1f)) { Text(q.name, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 12.sp); Text("TODAY", color = V4Muted, fontSize = 8.sp) }
        Column(horizontalAlignment = Alignment.End) { Text(v4Price(q.price), color = Color.White, fontWeight = FontWeight.Black, fontSize = 14.sp); Text(v4Pct(q.changePct), color = accent, fontWeight = FontWeight.Bold, fontSize = 11.sp) }
    }
}

@Composable
private fun V4Institutional(flow: InstitutionalFlow?, loading: Boolean) {
    V4PanelBox(V4Pink) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) { Text("FII / DII FLOW DESK", color = Color.White, fontSize = 18.sp, fontWeight = FontWeight.Black); Text("Automatic free-server fallback", color = V4Soft, fontSize = 10.sp) }
            V4Pill(if (loading) "SYNC" else if (flow != null) "CONNECTED" else "WAIT", if (flow != null) V4Green else V4Yellow)
        }
        Spacer(Modifier.height(12.dp))
        if (flow == null) Text("Waiting for FII/DII mirror servers…", color = V4Muted, fontSize = 11.sp) else {
            Text("CASH MARKET • ${flow.date}", color = V4Muted, fontSize = 9.sp, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                V4Metric("FII NET", v4Cr(flow.fiiNet), "B ${v4Cr(flow.fiiBuy)} • S ${v4Cr(flow.fiiSell)}", v4Sign(flow.fiiNet), Modifier.weight(1f))
                V4Metric("DII NET", v4Cr(flow.diiNet), "B ${v4Cr(flow.diiBuy)} • S ${v4Cr(flow.diiSell)}", v4Sign(flow.diiNet), Modifier.weight(1f))
            }
            Spacer(Modifier.height(8.dp)); Text(flow.source, color = V4Cyan, fontSize = 8.sp)
        }
    }
}

@Composable
private fun V4NewsCard(item: NewsItem) {
    val context = LocalContext.current
    val accent = when (item.sentiment) { "POSITIVE" -> V4Green; "NEGATIVE" -> V4Red; else -> V4Yellow }
    Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(17.dp)).background(Brush.linearGradient(listOf(accent.copy(.09f), V4Panel2, V4Panel))).border(1.dp, accent.copy(.20f), RoundedCornerShape(17.dp)).clickable {
        if (item.link.isNotBlank()) runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(item.link))) }
    }.padding(13.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            V4Pill(item.sentiment, accent); Spacer(Modifier.width(7.dp)); V4Pill(item.tickerHint, V4Cyan); Spacer(Modifier.weight(1f)); Text(item.source, color = V4Muted, fontSize = 8.sp)
        }
        Spacer(Modifier.height(9.dp)); Text(item.title, color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.Bold, maxLines = 3, overflow = TextOverflow.Ellipsis)
        if (item.published.isNotBlank()) { Spacer(Modifier.height(5.dp)); Text(item.published, color = V4Muted, fontSize = 8.sp) }
    }
}

@Composable
private fun V4Volume(q: MarketQuote) {
    V4PanelBox(V4Yellow) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            V4Badge(q.symbol, V4Yellow, 38.dp); Spacer(Modifier.width(10.dp)); Column(Modifier.weight(1f)) { Text(q.name, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 12.sp); Text("TODAY VOL ${v4Vol(q.volume)}", color = V4Muted, fontSize = 8.sp) }
            Text(if (q.volumeRatio > 0) String.format(Locale.US, "%.1f×", q.volumeRatio) else "—", color = V4Yellow, fontSize = 17.sp, fontWeight = FontWeight.Black)
        }
    }
}

@Composable
private fun V4Breakout(q: MarketQuote) {
    V4PanelBox(V4Pink) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            V4Badge(q.symbol, V4Pink, 38.dp); Spacer(Modifier.width(10.dp)); Column(Modifier.weight(1f)) { Text(q.name, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 12.sp); Text("52W HIGH ${v4Price(q.yearHigh)}", color = V4Muted, fontSize = 8.sp) }
            Column(horizontalAlignment = Alignment.End) { Text(v4Price(q.price), color = Color.White, fontWeight = FontWeight.Black, fontSize = 14.sp); Text(String.format(Locale.US, "%.2f%% away", q.distanceToHighPct), color = if (q.distanceToHighPct <= 2) V4Green else V4Yellow, fontSize = 9.sp, fontWeight = FontWeight.Bold) }
        }
    }
}

@Composable
private fun V4Metric(label: String, value: String, sub: String, accent: Color, modifier: Modifier = Modifier) {
    Column(modifier.clip(RoundedCornerShape(15.dp)).background(accent.copy(.08f)).border(1.dp, accent.copy(.18f), RoundedCornerShape(15.dp)).padding(11.dp)) {
        Text(label, color = V4Muted, fontSize = 8.sp, fontWeight = FontWeight.Bold); Text(value, color = accent, fontSize = 18.sp, fontWeight = FontWeight.Black); Text(sub, color = V4Soft, fontSize = 7.sp)
    }
}

@Composable
private fun V4Placeholder(title: String, detail: String, accent: Color) {
    V4PanelBox(accent) { Text(title, color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.Black); Spacer(Modifier.height(5.dp)); Text(detail, color = V4Soft, fontSize = 10.sp) }
}

@Composable
private fun V4Title(title: String, sub: String) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.Bottom) { Column(Modifier.weight(1f)) { Text(title, color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Black); Text(sub, color = V4Muted, fontSize = 9.sp) }; Text("NSTOX ALPHA", color = V4Cyan.copy(.55f), fontSize = 8.sp, fontWeight = FontWeight.Black) }
}

@Composable
private fun V4PanelBox(accent: Color, content: @Composable ColumnScope.() -> Unit) {
    Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(20.dp)).background(Brush.linearGradient(listOf(accent.copy(.10f), V4Panel2, V4Panel))).border(1.dp, accent.copy(.22f), RoundedCornerShape(20.dp)).padding(15.dp), content = content)
}

@Composable
private fun V4Pill(text: String, color: Color) {
    Box(Modifier.clip(RoundedCornerShape(20.dp)).background(color.copy(.10f)).border(1.dp, color.copy(.30f), RoundedCornerShape(20.dp)).padding(horizontal = 9.dp, vertical = 6.dp)) { Text(text, color = color, fontSize = 8.sp, fontWeight = FontWeight.Black) }
}

@Composable
private fun V4Badge(symbol: String, accent: Color, size: androidx.compose.ui.unit.Dp = 44.dp) {
    val clean = symbol.removePrefix("^").removeSuffix(".NS").take(3)
    Box(Modifier.size(size).clip(RoundedCornerShape(13.dp)).background(Brush.linearGradient(listOf(accent.copy(.28f), Color(0xFF10192A)))).border(1.dp, accent.copy(.42f), RoundedCornerShape(13.dp)), contentAlignment = Alignment.Center) { Text(clean, color = Color.White, fontSize = 9.sp, fontWeight = FontWeight.Black) }
}

@Composable
private fun V4Spark(values: List<Double>, color: Color, modifier: Modifier) {
    Canvas(modifier) {
        if (values.size < 2) return@Canvas
        val min = values.minOrNull() ?: return@Canvas; val max = values.maxOrNull() ?: return@Canvas; val span = (max - min).takeIf { it > 0 } ?: 1.0; val step = size.width / (values.size - 1)
        values.zipWithNext().forEachIndexed { i, p ->
            val y1 = size.height - ((p.first - min) / span * size.height * .78f).toFloat() - size.height * .11f
            val y2 = size.height - ((p.second - min) / span * size.height * .78f).toFloat() - size.height * .11f
            drawLine(color.copy(.92f), Offset(i * step, y1), Offset((i + 1) * step, y2), 3f, cap = StrokeCap.Round)
        }
    }
}

@Composable
private fun V4Footer() {
    Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(15.dp)).background(Color(0xAA060B13)).border(1.dp, Color.White.copy(.06f), RoundedCornerShape(15.dp)).padding(12.dp)) {
        Text("NSTOX ALPHA • 1-DAY DATA MODE", color = V4Cyan, fontSize = 9.sp, fontWeight = FontWeight.Black)
        Text("Prices: Yahoo 1D/5m chart feed. FII/DII: free mirrored daily dataset with automatic fallback. News: Google News + Mint RSS. Sentiment/ticker tags are local heuristics, not investment advice.", color = V4Muted, fontSize = 8.sp)
    }
}

private fun v4Sign(v: Double) = if (v >= 0) V4Green else V4Red
private fun v4Pct(v: Double) = String.format(Locale.US, "%+.2f%%", v)
private fun v4Price(v: Double) = if (v <= 0) "—" else String.format(Locale.US, "%,.2f", v)
private fun v4Cr(v: Double) = String.format(Locale.US, "%+.0f Cr", v)
private fun v4Vol(v: Long): String = when { v >= 10_000_000 -> String.format(Locale.US, "%.1fCr", v / 10_000_000.0); v >= 100_000 -> String.format(Locale.US, "%.1fL", v / 100_000.0); v >= 1_000 -> String.format(Locale.US, "%.1fK", v / 1_000.0); else -> v.toString() }
