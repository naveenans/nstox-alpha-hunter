package com.nstox.alpha

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

private val Bg = Color(0xFF050816)
private val Card = Color(0xFF0B1020)
private val Neon = Color(0xFF3FFFD8)
private val Blue = Color(0xFF56A8FF)
private val Positive = Color(0xFF32E875)
private val Negative = Color(0xFFFF5470)
private val TextMuted = Color(0xFF91A0B8)

data class DashboardSection(val title: String, val subtitle: String, val icon: String)

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { NstoxApp() }
    }
}

@Composable
fun NstoxApp() {
    val sections = listOf(
        DashboardSection("Global Indices", "US • Europe • Asia", "◎"),
        DashboardSection("Indian Indices", "NIFTY • BANK NIFTY • SENSEX", "◆"),
        DashboardSection("Top Gainers & Losers", "Today’s market movers", "↕"),
        DashboardSection("FII & DII", "Institutional cash-flow dashboard", "₹"),
        DashboardSection("Block & Bulk Deals", "Large exchange-reported deals", "▦"),
        DashboardSection("Volume Shockers", "Unusual volume vs baseline", "▥"),
        DashboardSection("52W Breakouts", "Near / crossing 52-week highs", "△"),
        DashboardSection("AI News", "Source-ranked market intelligence", "✦")
    )
    var selected by remember { mutableIntStateOf(0) }

    MaterialTheme(
        colorScheme = darkColorScheme(
            background = Bg,
            surface = Card,
            primary = Neon,
            secondary = Blue
        )
    ) {
        Scaffold(
            containerColor = Bg,
            bottomBar = {
                NavigationBar(containerColor = Color(0xFF080C19)) {
                    val destinations = listOf(0, 3, 5, 7)
                    listOf("Markets", "Flows", "Scanner", "AI").forEachIndexed { i, label ->
                        val isSelected = when (i) {
                            0 -> selected <= 2
                            1 -> selected in 3..4
                            2 -> selected in 5..6
                            else -> selected == 7
                        }
                        NavigationBarItem(
                            selected = isSelected,
                            onClick = { selected = destinations[i] },
                            icon = { Text(listOf("◈", "₹", "⌁", "✦")[i], color = if (isSelected) Neon else TextMuted) },
                            label = { Text(label, fontSize = 10.sp) }
                        )
                    }
                }
            }
        ) { padding ->
            Column(Modifier.fillMaxSize().padding(padding).padding(horizontal = 16.dp)) {
                Spacer(Modifier.height(12.dp))
                BrandHeader(sections[selected].title)
                Spacer(Modifier.height(14.dp))
                ScrollableTabs(sections, selected) { selected = it }
                Spacer(Modifier.height(14.dp))
                DashboardScreen(sections[selected], selected)
            }
        }
    }
}

@Composable
private fun BrandHeader(screen: String) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f)) {
            Text("NSTOX ALPHA", color = Neon, fontWeight = FontWeight.Black, fontSize = 21.sp, letterSpacing = 1.4.sp)
            Text(screen.uppercase(), color = Color.White, fontWeight = FontWeight.SemiBold, fontSize = 12.sp)
        }
        Surface(color = Color(0xFF10223A), shape = RoundedCornerShape(20.dp)) {
            Text("DATA", color = Neon, fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 12.dp, vertical = 7.dp), fontSize = 11.sp)
        }
    }
}

@Composable
private fun ScrollableTabs(sections: List<DashboardSection>, selected: Int, onSelect: (Int) -> Unit) {
    LazyColumn(modifier = Modifier.height(76.dp)) {
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                sections.forEachIndexed { index, item ->
                    FilterChip(
                        selected = selected == index,
                        onClick = { onSelect(index) },
                        label = { Text(item.icon + " " + item.title, fontSize = 10.sp) },
                        colors = FilterChipDefaults.filterChipColors(selectedContainerColor = Color(0xFF123A3A), selectedLabelColor = Neon)
                    )
                }
            }
        }
    }
}

@Composable
private fun DashboardScreen(section: DashboardSection, index: Int) {
    LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp), contentPadding = PaddingValues(bottom = 24.dp)) {
        item { HeroCard(section, index) }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                MiniMetric("STATUS", if (index == 7) "AI READY" else "API READY", Neon, Modifier.weight(1f))
                MiniMetric("REFRESH", "ON DEMAND", Blue, Modifier.weight(1f))
            }
        }
        items(screenRows(index)) { row -> DataRow(row.first, row.second, row.third) }
        item {
            Surface(color = Color(0xFF09111F), shape = RoundedCornerShape(16.dp), modifier = Modifier.fillMaxWidth()) {
                Text(
                    "Screenshot-safe layout • NSTOX ALPHA watermark always visible • Data source + timestamp should be attached to every published card.",
                    color = TextMuted,
                    fontSize = 11.sp,
                    modifier = Modifier.padding(14.dp)
                )
            }
        }
    }
}

@Composable
private fun HeroCard(section: DashboardSection, index: Int) {
    Surface(color = Card, shape = RoundedCornerShape(24.dp), modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(18.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(section.icon, color = Neon, fontSize = 28.sp)
                Spacer(Modifier.width(12.dp))
                Column {
                    Text(section.title, color = Color.White, fontSize = 22.sp, fontWeight = FontWeight.Bold)
                    Text(section.subtitle, color = TextMuted, fontSize = 12.sp)
                }
            }
            Spacer(Modifier.height(18.dp))
            Text(
                if (index == 7) "AI collector: ingest → deduplicate → score credibility → map tickers → summarize → preserve source link."
                else "Live-data adapter ready. Values remain blank until a permitted market-data provider is configured.",
                color = Color(0xFFD5E4F5),
                fontSize = 13.sp
            )
        }
    }
}

@Composable
private fun MiniMetric(label: String, value: String, accent: Color, modifier: Modifier = Modifier) {
    Surface(color = Card, shape = RoundedCornerShape(18.dp), modifier = modifier) {
        Column(Modifier.padding(14.dp)) {
            Text(label, color = TextMuted, fontSize = 9.sp, fontWeight = FontWeight.Bold)
            Text(value, color = accent, fontSize = 13.sp, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
private fun DataRow(name: String, value: String, change: String) {
    Surface(color = Card, shape = RoundedCornerShape(16.dp), modifier = Modifier.fillMaxWidth()) {
        Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
            Surface(color = Color(0xFF111A2B), shape = RoundedCornerShape(12.dp)) {
                Text(name.take(2), color = Neon, fontWeight = FontWeight.Bold, modifier = Modifier.padding(10.dp))
            }
            Spacer(Modifier.width(12.dp))
            Text(name, color = Color.White, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
            Column(horizontalAlignment = Alignment.End) {
                Text(value, color = Color.White, fontWeight = FontWeight.Bold)
                Text(change, color = when { change.startsWith("+") -> Positive; change.startsWith("-") -> Negative; else -> TextMuted }, fontSize = 11.sp)
            }
        }
    }
}

private fun screenRows(index: Int): List<Triple<String, String, String>> = when (index) {
    0 -> listOf(
        Triple("Dow Jones", "—", "Awaiting API"), Triple("NASDAQ", "—", "Awaiting API"),
        Triple("Nikkei 225", "—", "Awaiting API"), Triple("Hang Seng", "—", "Awaiting API")
    )
    1 -> listOf(
        Triple("NIFTY 50", "—", "Awaiting API"), Triple("BANK NIFTY", "—", "Awaiting API"),
        Triple("SENSEX", "—", "Awaiting API"), Triple("NIFTY MIDCAP", "—", "Awaiting API")
    )
    2 -> listOf(
        Triple("Top Gainer", "—", "Rank #1"), Triple("Top Gainer", "—", "Rank #2"),
        Triple("Top Loser", "—", "Rank #1"), Triple("Top Loser", "—", "Rank #2")
    )
    3 -> listOf(
        Triple("FII Cash", "—", "Net value"), Triple("DII Cash", "—", "Net value"),
        Triple("FII Buy", "—", "Gross"), Triple("DII Buy", "—", "Gross")
    )
    4 -> listOf(
        Triple("Block Deal", "—", "Exchange feed"), Triple("Bulk Deal", "—", "Exchange feed"),
        Triple("Largest Value", "—", "Today"), Triple("Most Active", "—", "Today")
    )
    5 -> listOf(
        Triple("Volume Shocker", "—", "> baseline"), Triple("Delivery Spike", "—", "Scanner"),
        Triple("Price + Volume", "—", "Scanner"), Triple("Turnover Spike", "—", "Scanner")
    )
    6 -> listOf(
        Triple("Near 52W High", "—", "≤ 2% away"), Triple("Fresh Breakout", "—", "Today"),
        Triple("High Volume Breakout", "—", "Confirmed"), Triple("Watchlist", "—", "Saved")
    )
    else -> listOf(
        Triple("Breaking", "—", "Source scored"), Triple("Earnings", "—", "Ticker mapped"),
        Triple("Regulatory", "—", "High priority"), Triple("Social Pulse", "—", "Unverified until sourced")
    )
}
