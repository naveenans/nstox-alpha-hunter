package com.nstox.alpha

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.withContext
import org.json.JSONObject
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

data class MarketSnapshot(
    val indices: List<MarketQuote> = emptyList(),
    val stocks: List<MarketQuote> = emptyList(),
    val updatedAt: String = "--:--",
    val error: String? = null
)

object MarketRepository {
    private val indexUniverse = listOf(
        "^DJI" to "Dow Jones",
        "^IXIC" to "NASDAQ",
        "^GSPC" to "S&P 500",
        "^N225" to "Nikkei 225",
        "^HSI" to "Hang Seng",
        "^FTSE" to "FTSE 100",
        "^NSEI" to "NIFTY 50",
        "^NSEBANK" to "BANK NIFTY",
        "^BSESN" to "SENSEX"
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

    suspend fun loadSnapshot(): MarketSnapshot = withContext(Dispatchers.IO) {
        try {
            val indices = fetchUniverse(indexUniverse)
            val stocks = fetchUniverse(nifty50)
            MarketSnapshot(
                indices = indices,
                stocks = stocks,
                updatedAt = SimpleDateFormat("HH:mm", Locale.getDefault()).format(Date()),
                error = if (indices.isEmpty() && stocks.isEmpty()) "Market feed temporarily unavailable" else null
            )
        } catch (t: Throwable) {
            MarketSnapshot(error = t.message ?: "Unable to load market data")
        }
    }

    private suspend fun fetchUniverse(universe: List<Pair<String, String>>): List<MarketQuote> = coroutineScope {
        val results = mutableListOf<MarketQuote>()
        universe.chunked(8).forEach { chunk ->
            val batch = chunk.map { (symbol, name) ->
                async(Dispatchers.IO) { runCatching { fetchYahooChart(symbol, name) }.getOrNull() }
            }.awaitAll().filterNotNull()
            results += batch
        }
        results
    }

    private fun fetchYahooChart(symbol: String, name: String): MarketQuote {
        val encoded = URLEncoder.encode(symbol, StandardCharsets.UTF_8.toString())
        val endpoint = "https://query1.finance.yahoo.com/v8/finance/chart/$encoded?interval=1d&range=1y&includePrePost=false"
        val conn = URL(endpoint).openConnection() as HttpURLConnection
        conn.connectTimeout = 8000
        conn.readTimeout = 10000
        conn.requestMethod = "GET"
        conn.setRequestProperty("User-Agent", "Mozilla/5.0 NSTOX-ALPHA/0.2")
        conn.setRequestProperty("Accept", "application/json")
        try {
            if (conn.responseCode !in 200..299) error("Yahoo HTTP ${conn.responseCode}")
            val body = conn.inputStream.bufferedReader().use { it.readText() }
            return parseYahooChart(symbol, name, JSONObject(body))
        } finally {
            conn.disconnect()
        }
    }

    private fun parseYahooChart(symbol: String, name: String, root: JSONObject): MarketQuote {
        val result = root.getJSONObject("chart").getJSONArray("result").getJSONObject(0)
        val meta = result.getJSONObject("meta")
        val indicators = result.getJSONObject("indicators").getJSONArray("quote").getJSONObject(0)
        val closesJson = indicators.getJSONArray("close")
        val highsJson = indicators.getJSONArray("high")
        val lowsJson = indicators.getJSONArray("low")
        val volumesJson = indicators.getJSONArray("volume")

        val closes = mutableListOf<Double>()
        val highs = mutableListOf<Double>()
        val lows = mutableListOf<Double>()
        val volumes = mutableListOf<Long>()
        for (i in 0 until closesJson.length()) {
            if (!closesJson.isNull(i)) closes += closesJson.optDouble(i)
            if (!highsJson.isNull(i)) highs += highsJson.optDouble(i)
            if (!lowsJson.isNull(i)) lows += lowsJson.optDouble(i)
            if (!volumesJson.isNull(i)) volumes += volumesJson.optLong(i)
        }

        val price = meta.optDouble("regularMarketPrice", closes.lastOrNull() ?: 0.0)
        val previous = meta.optDouble("chartPreviousClose", meta.optDouble("previousClose", closes.dropLast(1).lastOrNull() ?: price))
        val changeValue = price - previous
        val changePct = if (previous != 0.0) changeValue / previous * 100.0 else 0.0
        val currentVolume = meta.optLong("regularMarketVolume", volumes.lastOrNull() ?: 0L)
        val avgVolume20 = volumes.dropLast(1).takeLast(20).filter { it > 0 }.average().let { if (it.isNaN()) 0.0 else it }
        val high52 = max(meta.optDouble("fiftyTwoWeekHigh", 0.0), highs.maxOrNull() ?: 0.0)
        val low52 = if (meta.optDouble("fiftyTwoWeekLow", 0.0) > 0) meta.optDouble("fiftyTwoWeekLow") else lows.minOrNull() ?: 0.0
        val spark = closes.takeLast(32)

        return MarketQuote(
            symbol = symbol,
            name = name,
            price = price,
            changePct = changePct,
            changeValue = changeValue,
            volume = currentVolume,
            avgVolume20 = avgVolume20,
            yearHigh = high52,
            yearLow = low52,
            history = spark
        )
    }
}
