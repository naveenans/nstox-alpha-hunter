package com.nstox.alpha

import android.util.Xml
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.withContext
import org.json.JSONObject
import org.xmlpull.v1.XmlPullParser
import java.net.HttpURLConnection
import java.net.URLEncoder
import java.net.URL
import java.nio.charset.StandardCharsets
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlin.math.max

data class MarketQuote(
    val symbol: String,
    val name: String,
    val price: Double,
    val changePct: Double,
    val changeValue: Double,
    val volume: Long,
    val avgVolume20: Double,
    val yearHigh: Double,
    val yearLow: Double,
    val history: List<Double>,
    val source: String = "Yahoo Finance"
) {
    val volumeRatio: Double get() = if (avgVolume20 > 0) volume / avgVolume20 else 0.0
    val distanceToHighPct: Double get() = if (yearHigh > 0) ((yearHigh - price) / yearHigh) * 100.0 else 999.0
}

data class InstitutionalFlow(
    val date: String = "—",
    val fiiBuy: Double = 0.0,
    val fiiSell: Double = 0.0,
    val fiiNet: Double = 0.0,
    val diiBuy: Double = 0.0,
    val diiSell: Double = 0.0,
    val diiNet: Double = 0.0,
    val source: String = "Unavailable"
)

data class NewsItem(
    val title: String,
    val link: String,
    val source: String,
    val published: String,
    val sentiment: String,
    val tickerHint: String = "MARKET"
)

data class MarketSnapshot(
    val indices: List<MarketQuote> = emptyList(),
    val stocks: List<MarketQuote> = emptyList(),
    val commodities: List<MarketQuote> = emptyList(),
    val institutional: InstitutionalFlow? = null,
    val news: List<NewsItem> = emptyList(),
    val updatedAt: String = "--:--",
    val error: String? = null
)

object MarketRepository {
    private val indexUniverse = listOf(
        "NIFTY=F" to "GIFT Nifty", "^DJI" to "Dow Jones", "^IXIC" to "NASDAQ", "^GSPC" to "S&P 500",
        "^GDAXI" to "DAX", "^FTSE" to "FTSE 100", "^FCHI" to "CAC 40", "^N225" to "Nikkei 225",
        "^HSI" to "Hang Seng", "^TWII" to "Taiwan", "^AXJO" to "ASX 200", "IMOEX.ME" to "Russia MOEX",
        "^NSEI" to "NIFTY 50", "^NSEBANK" to "BANK NIFTY", "^BSESN" to "SENSEX"
    )

    private val commodityUniverse = listOf(
        "CL=F" to "Crude Oil", "BZ=F" to "Brent Oil", "GC=F" to "Gold",
        "SI=F" to "Silver", "HG=F" to "Copper", "NG=F" to "Natural Gas"
    )

    private val nifty50 = listOf(
        "ADANIENT.NS" to "Adani Ent", "ADANIPORTS.NS" to "Adani Ports", "APOLLOHOSP.NS" to "Apollo Hosp",
        "ASIANPAINT.NS" to "Asian Paints", "AXISBANK.NS" to "Axis Bank", "BAJAJ-AUTO.NS" to "Bajaj Auto",
        "BAJFINANCE.NS" to "Bajaj Finance", "BAJAJFINSV.NS" to "Bajaj Finserv", "BEL.NS" to "BEL",
        "BHARTIARTL.NS" to "Bharti Airtel", "CIPLA.NS" to "Cipla", "COALINDIA.NS" to "Coal India",
        "DRREDDY.NS" to "Dr Reddy's", "EICHERMOT.NS" to "Eicher Motors", "ETERNAL.NS" to "Eternal",
        "GRASIM.NS" to "Grasim", "HCLTECH.NS" to "HCL Tech", "HDFCBANK.NS" to "HDFC Bank",
        "HDFCLIFE.NS" to "HDFC Life", "HEROMOTOCO.NS" to "Hero MotoCorp", "HINDALCO.NS" to "Hindalco",
        "HINDUNILVR.NS" to "HUL", "ICICIBANK.NS" to "ICICI Bank", "INDUSINDBK.NS" to "IndusInd Bank",
        "INFY.NS" to "Infosys", "ITC.NS" to "ITC", "JIOFIN.NS" to "Jio Financial",
        "JSWSTEEL.NS" to "JSW Steel", "KOTAKBANK.NS" to "Kotak Bank", "LT.NS" to "L&T",
        "M&M.NS" to "M&M", "MARUTI.NS" to "Maruti", "NESTLEIND.NS" to "Nestle India",
        "NTPC.NS" to "NTPC", "ONGC.NS" to "ONGC", "POWERGRID.NS" to "Power Grid",
        "RELIANCE.NS" to "Reliance", "SBILIFE.NS" to "SBI Life", "SBIN.NS" to "SBI",
        "SHRIRAMFIN.NS" to "Shriram Finance", "SUNPHARMA.NS" to "Sun Pharma", "TATACONSUM.NS" to "Tata Consumer",
        "TATAMOTORS.NS" to "Tata Motors", "TATASTEEL.NS" to "Tata Steel", "TCS.NS" to "TCS",
        "TECHM.NS" to "Tech Mahindra", "TITAN.NS" to "Titan", "TRENT.NS" to "Trent",
        "ULTRACEMCO.NS" to "UltraTech", "WIPRO.NS" to "Wipro"
    )

    private val fiiServers = listOf(
        "https://chirag127.github.io/fii-dii-activity-api/data/latest.json" to "FII/DII GitHub Pages",
        "https://raw.githubusercontent.com/chirag127/fii-dii-activity-api/main/data/latest.json" to "FII/DII GitHub Raw",
        "https://cdn.jsdelivr.net/gh/chirag127/fii-dii-activity-api@main/data/latest.json" to "FII/DII jsDelivr"
    )

    private val newsFeeds = listOf(
        Triple("https://news.google.com/rss/search?q=India+stock+market+Nifty+Sensex&hl=en-IN&gl=IN&ceid=IN:en", "Google News India", "MARKET"),
        Triple("https://news.google.com/rss/search?q=global+stock+markets+Nasdaq+Dow+oil+gold&hl=en-IN&gl=IN&ceid=IN:en", "Google News Global", "GLOBAL"),
        Triple("https://www.livemint.com/rss/marketsRSS", "Mint Markets", "MARKET")
    )

    suspend fun loadSnapshot(): MarketSnapshot = withContext(Dispatchers.IO) {
        try {
            coroutineScope {
                val indicesJob = async { fetchUniverse(indexUniverse) }
                val stocksJob = async { fetchUniverse(nifty50) }
                val commodityJob = async { fetchUniverse(commodityUniverse) }
                val flowJob = async { fetchInstitutionalFlow() }
                val newsJob = async { fetchNews() }
                val indices = indicesJob.await()
                val stocks = stocksJob.await()
                MarketSnapshot(
                    indices = indices,
                    stocks = stocks,
                    commodities = commodityJob.await(),
                    institutional = flowJob.await(),
                    news = newsJob.await(),
                    updatedAt = SimpleDateFormat("HH:mm", Locale.getDefault()).format(Date()),
                    error = if (indices.isEmpty() && stocks.isEmpty()) "Market feed temporarily unavailable" else null
                )
            }
        } catch (t: Throwable) {
            MarketSnapshot(error = t.message ?: "Unable to load market data")
        }
    }

    private suspend fun fetchUniverse(universe: List<Pair<String, String>>): List<MarketQuote> = coroutineScope {
        val results = mutableListOf<MarketQuote>()
        universe.chunked(8).forEach { chunk ->
            results += chunk.map { (symbol, name) -> async(Dispatchers.IO) { runCatching { fetchYahooDay(symbol, name) }.getOrNull() } }
                .awaitAll().filterNotNull()
        }
        results
    }

    private fun fetchYahooDay(symbol: String, name: String): MarketQuote {
        val encoded = URLEncoder.encode(symbol, StandardCharsets.UTF_8.toString())
        val endpoint = "https://query1.finance.yahoo.com/v8/finance/chart/$encoded?interval=5m&range=1d&includePrePost=false"
        val root = JSONObject(httpGet(endpoint, "Mozilla/5.0 NSTOX-ALPHA/0.4"))
        val result = root.getJSONObject("chart").getJSONArray("result").getJSONObject(0)
        val meta = result.getJSONObject("meta")
        val quote = result.getJSONObject("indicators").getJSONArray("quote").getJSONObject(0)
        val closesJson = quote.getJSONArray("close")
        val volumesJson = quote.getJSONArray("volume")
        val closes = mutableListOf<Double>()
        var intradayVolume = 0L
        for (i in 0 until closesJson.length()) if (!closesJson.isNull(i)) closes += closesJson.optDouble(i)
        for (i in 0 until volumesJson.length()) if (!volumesJson.isNull(i)) intradayVolume += volumesJson.optLong(i)
        val price = meta.optDouble("regularMarketPrice", closes.lastOrNull() ?: 0.0)
        val previous = meta.optDouble("chartPreviousClose", meta.optDouble("previousClose", price))
        val changeValue = price - previous
        val changePct = if (previous != 0.0) changeValue / previous * 100.0 else 0.0
        val regularVolume = meta.optLong("regularMarketVolume", intradayVolume)
        val avgVolume = meta.optDouble("averageDailyVolume10Day", meta.optDouble("averageDailyVolume3Month", 0.0))
        return MarketQuote(
            symbol, name, price, changePct, changeValue, regularVolume, avgVolume,
            meta.optDouble("fiftyTwoWeekHigh", 0.0), meta.optDouble("fiftyTwoWeekLow", 0.0),
            closes.takeLast(50), "Yahoo Finance • 1D/5m"
        )
    }

    private fun fetchInstitutionalFlow(): InstitutionalFlow? {
        for ((url, label) in fiiServers) {
            val flow = runCatching {
                val root = JSONObject(httpGet(url, "NSTOX-ALPHA/0.4"))
                val eq = root.getJSONObject("equity")
                val source = root.optString("source", "unknown")
                if (source.equals("placeholder", true)) error("placeholder data")
                InstitutionalFlow(
                    date = root.optString("date", "—"),
                    fiiBuy = eq.optDouble("fii_buy"), fiiSell = eq.optDouble("fii_sell"), fiiNet = eq.optDouble("fii_net"),
                    diiBuy = eq.optDouble("dii_buy"), diiSell = eq.optDouble("dii_sell"), diiNet = eq.optDouble("dii_net"),
                    source = "$label • ${source.uppercase()}"
                )
            }.getOrNull()
            if (flow != null) return flow
        }
        return null
    }

    private fun fetchNews(): List<NewsItem> {
        val all = mutableListOf<NewsItem>()
        newsFeeds.forEach { (url, source, hint) ->
            runCatching { all += parseRss(httpGet(url, "Mozilla/5.0 NSTOX-ALPHA/0.4"), source, hint) }
        }
        return all.distinctBy { normalizeTitle(it.title) }.take(24)
    }

    private fun parseRss(xml: String, source: String, defaultHint: String): List<NewsItem> {
        val parser = Xml.newPullParser()
        parser.setInput(xml.reader())
        val out = mutableListOf<NewsItem>()
        var event = parser.eventType
        var inItem = false
        var title = ""
        var link = ""
        var published = ""
        while (event != XmlPullParser.END_DOCUMENT) {
            when (event) {
                XmlPullParser.START_TAG -> when (parser.name.lowercase()) {
                    "item" -> { inItem = true; title = ""; link = ""; published = "" }
                    "title" -> if (inItem) title = parser.nextText().trim()
                    "link" -> if (inItem) link = parser.nextText().trim()
                    "pubdate" -> if (inItem) published = parser.nextText().trim()
                }
                XmlPullParser.END_TAG -> if (parser.name.equals("item", true) && inItem) {
                    if (title.isNotBlank()) out += NewsItem(title, link, source, published, sentiment(title), tickerHint(title, defaultHint))
                    inItem = false
                }
            }
            event = parser.next()
        }
        return out.take(10)
    }

    private fun sentiment(text: String): String {
        val t = text.lowercase()
        val positive = listOf("rally", "gain", "surge", "record", "upgrade", "beats", "profit", "buy", "growth", "high")
        val negative = listOf("fall", "drop", "crash", "selloff", "downgrade", "loss", "fraud", "weak", "slump", "low")
        val p = positive.count { it in t }; val n = negative.count { it in t }
        return when { p > n -> "POSITIVE"; n > p -> "NEGATIVE"; else -> "NEUTRAL" }
    }

    private fun tickerHint(text: String, fallback: String): String {
        val t = text.lowercase()
        val map = listOf("reliance" to "RELIANCE", "hdfc" to "HDFC", "infosys" to "INFY", "tcs" to "TCS", "adani" to "ADANI", "nifty" to "NIFTY", "sensex" to "SENSEX", "nasdaq" to "NASDAQ", "gold" to "GOLD", "oil" to "OIL")
        return map.firstOrNull { it.first in t }?.second ?: fallback
    }

    private fun normalizeTitle(s: String) = s.lowercase().replace(Regex("[^a-z0-9 ]"), "").trim()

    private fun httpGet(url: String, userAgent: String): String {
        val conn = URL(url).openConnection() as HttpURLConnection
        conn.connectTimeout = 9000
        conn.readTimeout = 12000
        conn.requestMethod = "GET"
        conn.setRequestProperty("User-Agent", userAgent)
        conn.setRequestProperty("Accept", "application/json, application/rss+xml, application/xml, text/xml, */*")
        try {
            if (conn.responseCode !in 200..299) error("HTTP ${conn.responseCode}")
            return conn.inputStream.bufferedReader().use { it.readText() }
        } finally { conn.disconnect() }
    }
}
