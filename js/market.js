/**
 * Market engine — demo universe, live ticks, regime, sectors.
 * When FYERS is connected, quotes overlay demo bars. CORS failures stay in demo.
 */
import { Storage, hashStr, mulberry32, getMarketStatus, lastSessionCloseMs, isSessionLive, inr, fmtPct } from "./storage.js";
import { analyzeBars } from "./technicals.js";
import { scoreSymbol, decideSignal } from "./scoring.js";
import { buildPlan, classicPivots } from "./levels.js";
import { isFyersConnected, getQuotes } from "./fyers.js";

const NIFTY50 = [
  ["RELIANCE", "Reliance Industries", 1316.0, 2.8, "ENERGY"],
  ["HDFCBANK", "HDFC Bank", 726.95, 1.9, "BANKING"],
  ["BHARTIARTL", "Bharti Airtel", 1946.0, 4.3, "TELECOM"],
  ["TCS", "Tata Consultancy", 2302.0, 4.0, "IT"],
  ["ICICIBANK", "ICICI Bank", 1420.0, 8.1, "BANKING"],
  ["SBIN", "State Bank of India", 1048.7, 0.7, "PSU BANK"],
  ["INFY", "Infosys", 1121.0, -9.0, "IT"],
  ["BAJFINANCE", "Bajaj Finance", 1095.0, 0.0, "FINANCIAL SERVICES"],
  ["HINDUNILVR", "Hindustan Unilever", 2015.0, -13.0, "FMCG"],
  ["ITC", "ITC", 269.4, -2.25, "FMCG"],
  ["LT", "Larsen & Toubro", 4093.0, 12.0, "INFRA"],
  ["MARUTI", "Maruti Suzuki", 13565.0, -244.0, "AUTO"],
  ["AXISBANK", "Axis Bank", 1245.8, -5.2, "BANKING"],
  ["KOTAKBANK", "Kotak Mahindra Bank", 402.8, 5.45, "BANKING"],
  ["SUNPHARMA", "Sun Pharma", 1902.4, -1.6, "PHARMA"],
  ["HCLTECH", "HCL Technologies", 1302.5, -15.9, "IT"],
  ["M&M", "Mahindra & Mahindra", 3412.2, -12.6, "AUTO"],
  ["ETERNAL", "Eternal", 328.0, 0.05, "SERVICES"],
  ["TITAN", "Titan Company", 5086.1, 18.1, "CONSUMER DURABLES"],
  ["ULTRACEMCO", "UltraTech Cement", 11570.0, -5.0, "CEMENT"],
  ["NTPC", "NTPC", 340.0, 2.5, "POWER"],
  ["BAJAJFINSV", "Bajaj Finserv", 2032.5, 16.5, "FINANCIAL SERVICES"],
  ["ADANIENT", "Adani Enterprises", 2997.0, 2.1, "ENERGY"],
  ["ONGC", "ONGC", 236.4, -2.1, "OIL & GAS"],
  ["POWERGRID", "Power Grid", 272.4, 7.6, "POWER"],
  ["WIPRO", "Wipro", 180.79, -0.21, "IT"],
  ["ASIANPAINT", "Asian Paints", 2640.0, 14.8, "FMCG"],
  ["ADANIPORTS", "Adani Ports", 1700.0, 4.0, "INFRA"],
  ["COALINDIA", "Coal India", 405.2, 2.7, "ENERGY"],
  ["JSWSTEEL", "JSW Steel", 1293.7, -6.0, "METAL"],
  ["TATASTEEL", "Tata Steel", 183.0, -0.5, "METAL"],
  ["NESTLEIND", "Nestle India", 1477.1, 19.1, "FMCG"],
  ["BEL", "Bharat Electronics", 414.0, 4.6, "DEFENCE"],
  ["JIOFIN", "Jio Financial Services", 244.0, -0.6, "FINANCIAL SERVICES"],
  ["GRASIM", "Grasim Industries", 3308.0, 8.0, "METAL"],
  ["TECHM", "Tech Mahindra", 1584.0, -8.1, "IT"],
  ["TRENT", "Trent", 2924.0, -46.0, "FMCG"],
  ["HINDALCO", "Hindalco", 1034.0, 4.15, "METAL"],
  ["CIPLA", "Cipla", 1432.2, -5.8, "PHARMA"],
  ["TATAPV", "Tata Motors PV", 317.9, -2.35, "AUTO"],
  ["BAJAJ-AUTO", "Bajaj Auto", 11700.0, -93.0, "AUTO"],
  ["EICHERMOT", "Eicher Motors", 8010.0, -32.0, "AUTO"],
  ["DRREDDY", "Dr Reddy's", 1174.7, -5.3, "PHARMA"],
  ["TATACONSUM", "Tata Consumer", 1049.0, -7.3, "FMCG"],
  ["APOLLOHOSP", "Apollo Hospitals", 8693.0, -42.0, "HEALTHCARE"],
  ["SHRIRAMFIN", "Shriram Finance", 1130.0, 1.8, "FINANCIAL SERVICES"],
  ["SBILIFE", "SBI Life", 1792.9, 10.9, "INSURANCE"],
  ["HDFCLIFE", "HDFC Life", 554.8, 12.8, "INSURANCE"],
  ["INDIGO", "InterGlobe Aviation", 5110.0, -55.0, "SERVICES"],
  ["MAXHEALTH", "Max Healthcare", 1000.0, 2.1, "HEALTHCARE"],
];

const EXTRA_FNO = [
  ["TATACV", "Tata Motors CV", 472.55, 477.6, "AUTO"],
  ["HEROMOTOCO", "Hero MotoCorp", 5735.0, 5745.0, "AUTO"],
  ["INDUSINDBK", "IndusInd Bank", 1005.6, 1010.6, "BANKING"],
  ["BPCL", "BPCL", 311.0, 316.65, "OIL & GAS"],
  ["DIVISLAB", "Divi's Labs", 8597.0, 8481.5, "PHARMA"],
  ["BANKBARODA", "Bank of Baroda", 247.0, 246.55, "PSU BANK"],
  ["PNB", "Punjab National Bank", 116.55, 117.32, "PSU BANK"],
  ["CANBK", "Canara Bank", 129.96, 131.1, "PSU BANK"],
  ["DLF", "DLF", 678.1, 671.0, "REALTY"],
  ["GODREJPROP", "Godrej Properties", 2035.0, 2054.0, "REALTY"],
  ["OBEROIRLTY", "Oberoi Realty", 1886.0, 1931.0, "REALTY"],
  ["LODHA", "Macrotech Developers", 1242.0, 1254.0, "REALTY"],
  ["IRFC", "IRFC", 86.4, 87.05, "PSU"],
  ["RECLTD", "REC", 326.65, 340.0, "FINANCIAL SERVICES"],
  ["PFC", "Power Finance", 363.0, 374.4, "FINANCIAL SERVICES"],
  ["VEDL", "Vedanta", 279.0, 269.7, "METAL"],
  ["HINDZINC", "Hindustan Zinc", 594.9, 567.5, "METAL"],
  ["NMDC", "NMDC", 84.61, 85.5, "METAL"],
  ["IOC", "Indian Oil", 135.9, 138.61, "OIL & GAS"],
  ["GAIL", "GAIL", 172.0, 172.1, "OIL & GAS"],
  ["TVSMOTOR", "TVS Motor", 4390.0, 4385.9, "AUTO"],
  ["ASHOKLEY", "Ashok Leyland", 173.0, 177.1, "AUTO"],
  ["MOTHERSON", "Samvardhana Motherson", 169.38, 168.06, "AUTO"],
  ["PERSISTENT", "Persistent Systems", 5667.5, 5570.0, "IT"],
  ["COFORGE", "Coforge", 1891.7, 1806.0, "IT"],
  ["LUPIN", "Lupin", 2201.8, 2259.0, "PHARMA"],
  ["AUROPHARMA", "Aurobindo Pharma", 1621.3, 1627.2, "PHARMA"],
  ["DABUR", "Dabur", 400.5, 406.8, "FMCG"],
  ["GODREJCP", "Godrej Consumer", 933.0, 928.0, "FMCG"],
  ["PIDILITIND", "Pidilite", 1649.0, 1669.0, "FMCG"],
  ["HAVELLS", "Havells", 1268.0, 1299.0, "CONSUMER DURABLES"],
  ["SIEMENS", "Siemens", 3920.0, 3943.0, "CAPITAL GOODS"],
  ["ABB", "ABB India", 7424.0, 7660.0, "CAPITAL GOODS"],
];

const EXTRA_SECTOR = [
  ["HAL", "Hindustan Aeronautics", 5000.0, 5059.0, "DEFENCE", "MID"],
  ["MAZDOCK", "Mazagon Dock", 2552.0, 2569.7, "DEFENCE", "MID"],
  ["COCHINSHIP", "Cochin Shipyard", 1480.5, 1457.8, "DEFENCE", "SMALL"],
  ["GRSE", "Garden Reach Shipbuilders", 2601.5, 2600.1, "DEFENCE", "SMALL"],
  ["BDL", "Bharat Dynamics", 1359.0, 1380.0, "DEFENCE", "MID"],
  ["SOLARINDS", "Solar Industries", 19900.0, 20000.0, "DEFENCE", "MID"],
  ["BHEL", "BHEL", 413.0, 435.95, "CAPITAL GOODS", "MID"],
  ["CUMMINSIND", "Cummins India", 5107.5, 5450.0, "CAPITAL GOODS", "MID"],
  ["ADANIGREEN", "Adani Green", 1320.0, 1327.6, "POWER", "LARGE"],
  ["ADANIPOWER", "Adani Power", 205.5, 203.56, "POWER", "LARGE"],
  ["TATAPOWER", "Tata Power", 374.3, 381.5, "POWER", "LARGE"],
  ["NHPC", "NHPC", 76.15, 76.6, "POWER", "MID"],
  ["SJVN", "SJVN", 66.06, 66.56, "POWER", "SMALL"],
  ["TORNTPOWER", "Torrent Power", 1247.7, 1312.8, "POWER", "MID"],
  ["PETRONET", "Petronet LNG", 293.0, 281.8, "OIL & GAS", "MID"],
  ["IGL", "Indraprastha Gas", 147.87, 151.0, "OIL & GAS", "MID"],
  ["OIL", "Oil India", 475.0, 474.65, "OIL & GAS", "MID"],
  ["ATGL", "Adani Total Gas", 646.1, 646.9, "OIL & GAS", "MID"],
  ["VOLTAS", "Voltas", 1235.0, 1267.0, "CONSUMER DURABLES", "MID"],
  ["BLUESTARCO", "Blue Star", 1511.9, 1508.1, "CONSUMER DURABLES", "MID"],
  ["CROMPTON", "Crompton Greaves", 252.0, 246.5, "CONSUMER DURABLES", "MID"],
  ["WHIRLPOOL", "Whirlpool India", 768.5, 777.35, "CONSUMER DURABLES", "SMALL"],
  ["KAJARIACER", "Kajaria Ceramics", 1208.5, 1251.6, "CONSUMER DURABLES", "SMALL"],
  ["BOSCHLTD", "Bosch", 48200.0, 46970.0, "AUTO", "MID"],
  ["ASTRAL", "Astral", 1528.5, 1538.3, "CONSUMER DURABLES", "MID"],
  ["SUPREMEIND", "Supreme Industries", 3642.0, 3590.0, "CONSUMER DURABLES", "MID"],
  ["VBL", "Varun Beverages", 430.1, 433.85, "FMCG", "LARGE"],
  ["UBL", "United Breweries", 1348.9, 1367.9, "FMCG", "MID"],
  ["MARICO", "Marico", 849.25, 852.05, "FMCG", "LARGE"],
  ["COLPAL", "Colgate-Palmolive", 1889.0, 1964.0, "FMCG", "MID"],
  ["BRITANNIA", "Britannia", 5365.0, 5521.0, "FMCG", "LARGE"],
  ["PAGEIND", "Page Industries", 35480.0, 37360.0, "FMCG", "MID"],
  ["TATACHEM", "Tata Chemicals", 626.75, 662.9, "CHEMICALS", "MID"],
  ["SRF", "SRF", 2571.9, 2616.0, "CHEMICALS", "MID"],
  ["PIIND", "PI Industries", 2496.8, 2472.0, "CHEMICALS", "MID"],
  ["DEEPAKNTR", "Deepak Nitrite", 1747.1, 1780.5, "CHEMICALS", "MID"],
  ["UPL", "UPL", 569.0, 567.1, "CHEMICALS", "MID"],
  ["COROMANDEL", "Coromandel International", 1996.1, 2097.9, "CHEMICALS", "MID"],
  ["NAVINFLUOR", "Navin Fluorine", 8206.5, 8151.0, "CHEMICALS", "SMALL"],
  ["CHAMBLFERT", "Chambal Fertilisers", 431.15, 439.05, "CHEMICALS", "SMALL"],
  ["ZEEL", "Zee Entertainment", 107.58, 104.87, "MEDIA", "SMALL"],
  ["SUNTV", "Sun TV Network", 472.05, 488.25, "MEDIA", "SMALL"],
  ["PVRINOX", "PVR INOX", 1216.8, 1192.0, "MEDIA", "SMALL"],
  ["IDEA", "Vodafone Idea", 13.94, 13.71, "TELECOM", "MID"],
  ["INDUSTOWER", "Indus Towers", 375.75, 380.0, "TELECOM", "LARGE"],
  ["TATACOMM", "Tata Communications", 1655.4, 1711.9, "TELECOM", "MID"],
  ["LICI", "LIC of India", 422.25, 410.0, "INSURANCE", "LARGE"],
  ["GICRE", "GIC Re", 355.75, 355.5, "INSURANCE", "MID"],
  ["NIACL", "New India Assurance", 184.13, 183.64, "INSURANCE", "SMALL"],
  ["CONCOR", "Container Corporation", 515.05, 524.5, "INFRA", "MID"],
  ["GMRAIRPORT", "GMR Airports", 99.63, 101.31, "INFRA", "MID"],
  ["IRB", "IRB Infrastructure", 18.95, 19.17, "INFRA", "SMALL"],
  ["NH", "Narayana Hrudayalaya", 1815.8, 1828.5, "HEALTHCARE", "MID"],
  ["ALKEM", "Alkem Laboratories", 5400.0, 5374.0, "PHARMA", "MID"],
  ["BIOCON", "Biocon", 415.55, 412.0, "PHARMA", "MID"],
  ["TORNTPHARM", "Torrent Pharma", 4896.5, 4900.0, "PHARMA", "MID"],
  ["GLENMARK", "Glenmark Pharma", 2317.9, 2329.0, "PHARMA", "MID"],
  ["LAURUSLABS", "Laurus Labs", 1802.0, 1809.7, "PHARMA", "MID"],
  ["SAIL", "SAIL", 173.46, 173.6, "METAL", "MID"],
  ["JINDALSTEL", "Jindal Steel", 1127.8, 1116.1, "METAL", "LARGE"],
  ["NATIONALUM", "NALCO", 394.45, 387.55, "METAL", "MID"],
  ["HINDCOPPER", "Hindustan Copper", 572.7, 572.65, "METAL", "SMALL"],
  ["APLAPOLLO", "APL Apollo", 2139.0, 2081.3, "METAL", "MID"],
  ["IDFCFIRSTB", "IDFC First Bank", 86.75, 85.05, "BANKING", "MID"],
  ["FEDERALBNK", "Federal Bank", 361.0, 354.1, "BANKING", "MID"],
  ["AUBANK", "AU Small Finance Bank", 1108.2, 1072.2, "BANKING", "MID"],
  ["BANDHANBNK", "Bandhan Bank", 175.1, 173.25, "BANKING", "SMALL"],
  ["YESBANK", "Yes Bank", 22.8, 22.92, "BANKING", "SMALL"],
  ["MUTHOOTFIN", "Muthoot Finance", 3022.0, 2888.5, "FINANCIAL SERVICES", "MID"],
  ["CHOLAFIN", "Cholamandalam Finance", 1862.9, 1884.7, "FINANCIAL SERVICES", "LARGE"],
  ["MANAPPURAM", "Manappuram Finance", 357.5, 348.6, "FINANCIAL SERVICES", "SMALL"],
  ["LICHSGFIN", "LIC Housing Finance", 497.0, 498.25, "FINANCIAL SERVICES", "MID"],
  ["IIFL", "IIFL Finance", 679.8, 630.05, "FINANCIAL SERVICES", "SMALL"],
  ["ANGELONE", "Angel One", 287.8, 293.5, "FINANCIAL SERVICES", "SMALL"],
  ["MOTILALOFS", "Motilal Oswal", 990.0, 955.0, "FINANCIAL SERVICES", "SMALL"],
  ["MCX", "MCX", 3185.0, 2933.1, "FINANCIAL SERVICES", "MID"],
  ["PAYTM", "One97 Communications", 1632.0, 1580.2, "FINANCIAL SERVICES", "MID"],
  ["POLICYBZR", "PB Fintech", 1795.2, 1728.1, "FINANCIAL SERVICES", "MID"],
  ["KPITTECH", "KPIT Technologies", 589.3, 609.0, "IT", "MID"],
  ["MPHASIS", "Mphasis", 2430.0, 2510.0, "IT", "MID"],
  ["LTTS", "L&T Technology Services", 3604.6, 3528.5, "IT", "MID"],
  ["OFSS", "Oracle Financial Services", 11724.0, 11789.0, "IT", "MID"],
  ["TATAELXSI", "Tata Elxsi", 3708.0, 3760.0, "IT", "MID"],
  ["NAUKRI", "Info Edge", 1350.1, 1355.8, "IT", "MID"],
  ["PRESTIGE", "Prestige Estates", 1631.0, 1591.9, "REALTY", "MID"],
  ["PHOENIXLTD", "Phoenix Mills", 1930.0, 1929.8, "REALTY", "MID"],
  ["BRIGADE", "Brigade Enterprises", 639.3, 593.7, "REALTY", "SMALL"],
  ["TIINDIA", "Tube Investments", 2885.8, 2741.4, "AUTO", "MID"],
  ["BALKRISIND", "Balkrishna Industries", 2350.8, 2407.2, "AUTO", "MID"],
  ["MRF", "MRF", 132665.0, 133015.0, "AUTO", "MID"],
  ["APOLLOTYRE", "Apollo Tyres", 439.7, 436.7, "AUTO", "MID"],
  ["EXIDEIND", "Exide Industries", 459.6, 475.7, "AUTO", "MID"],
  ["JUBLFOOD", "Jubilant FoodWorks", 506.75, 511.5, "SERVICES", "MID"],
  ["NYKAA", "Nykaa", 334.0, 327.05, "SERVICES", "MID"],
  ["DMART", "Avenue Supermarts", 3906.0, 3995.0, "SERVICES", "LARGE"],
  ["IRCTC", "IRCTC", 484.2, 499.95, "SERVICES", "MID"],
  ["DEVYANI", "Devyani International", 144.4, 143.65, "SERVICES", "SMALL"],
];

const INDICES = [
  ["NIFTY", "Nifty 50", 24252.0, 24231.85, "broad"],
  ["NIFTYNXT50", "Nifty Next 50", 73832.1, 74195.86, "broad"],
  ["NIFTY100", "Nifty 100", 25370.45, 25390.76, "broad"],
  ["NIFTY500", "Nifty 500", 23513.0, 23513.0, "broad"],
  ["BANKNIFTY", "Bank Nifty", 57761.95, 57495.9, "broad"],
  ["SENSEX", "Sensex", 77540.83, 77537.72, "broad"],
  ["FINNIFTY", "FinNifty", 26261.0, 26203.9, "broad"],
  ["INDIAVIX", "India VIX", 11.2, 10.76, "broad"],
];

const GLOBAL_INDICES = [
  ["GIFTNIFTY", "GIFT Nifty", "India", 24310, 24294, "₹", "in", { kind: "gift" }],
  ["SPX", "S&P 500", "US", 7674.37, 7641.16, "$", "us", { tz: "America/New_York", open: 9 * 60 + 30, close: 16 * 60 }],
  ["NASDAQ", "Nasdaq", "US", 26180.46, 26067.17, "$", "us", { tz: "America/New_York", open: 9 * 60 + 30, close: 16 * 60 }],
  ["FTSE100", "FTSE 100", "UK", 10816.56, 10748.2, "£", "gb", { tz: "Europe/London", open: 8 * 60, close: 16 * 60 + 30 }],
  ["CAC40", "CAC 40", "France", 8484.43, 8453.09, "€", "fr", { tz: "Europe/Paris", open: 9 * 60, close: 17 * 60 + 30 }],
  ["DAX", "DAX", "Germany", 26136.56, 25983.04, "€", "de", { tz: "Europe/Berlin", open: 9 * 60, close: 17 * 60 + 30 }],
  ["NIKKEI", "Nikkei 225", "Japan", 66016.36, 66216.79, "¥", "jp", { tz: "Asia/Tokyo", open: 9 * 60, close: 15 * 60, lunch: [11 * 60 + 30, 12 * 60 + 30] }],
  ["HANGSENG", "Hang Seng", "Hong Kong", 26009.46, 25698.49, "HK$", "hk", { tz: "Asia/Hong_Kong", open: 9 * 60 + 30, close: 16 * 60, lunch: [12 * 60, 13 * 60] }],
  ["TAIWAN", "Taiwan Index", "Taiwan", 45224.29, 44933.74, "NT$", "tw", { tz: "Asia/Taipei", open: 9 * 60, close: 13 * 60 + 30 }],
  ["ASX200", "ASX 200", "Australia", 9058.9, 9083.8, "A$", "au", { tz: "Australia/Sydney", open: 10 * 60, close: 16 * 60 }],
];

const CAP_INDICES = [
  ["MIDCAP100", "Nifty Midcap 100", 63687.75, 63668.65, "cap"],
  ["MIDCAP50", "Nifty Midcap 50", 18292.35, 18301.5, "cap"],
  ["SMALLCAP100", "Nifty Smallcap 100", 19983.75, 19840.9, "cap"],
  ["SMALLCAP250", "Nifty Smallcap 250", 18426.0, 18337.98, "cap"],
  ["MICROCAP250", "Nifty Microcap 250", 26359.7, 26267.76, "cap"],
];

const SECTOR_INDICES = [
  ["NIFTYIT", "Nifty IT", 30475.7, 30672.0, "sector", "IT"],
  ["NIFTYAUTO", "Nifty Auto", 29147.55, 29302.75, "sector", "AUTO"],
  ["NIFTYPHARMA", "Nifty Pharma", 26302.9, 26416.5, "sector", "PHARMA"],
  ["NIFTYFMCG", "Nifty FMCG", 47501.2, 47864.8, "sector", "FMCG"],
  ["NIFTYMETAL", "Nifty Metal", 13159.15, 13059.9, "sector", "METAL"],
  ["NIFTYENERGY", "Nifty Energy", 38219.05, 38150.35, "sector", "ENERGY"],
  ["NIFTYREALTY", "Nifty Realty", 910.45, 907.91, "sector", "REALTY"],
  ["NIFTYPSUBANK", "Nifty PSU Bank", 8577.05, 8616.67, "sector", "PSU BANK"],
  ["NIFTYPVTBANK", "Nifty Private Bank", 27581.5, 27449.65, "sector", "BANKING"],
  ["NIFTYMEDIA", "Nifty Media", 1614.5, 1621.47, "sector", "MEDIA"],
  ["NIFTYINFRA", "Nifty Infra", 9344.75, 9349.42, "sector", "INFRA"],
  ["NIFTYHEALTH", "Nifty Healthcare", 16384.4, 16465.05, "sector", "HEALTHCARE"],
  ["NIFTYCONSDUR", "Nifty Consumer Durables", 40536.0, 40503.6, "sector", "CONSUMER DURABLES"],
  ["NIFTYOILGAS", "Nifty Oil & Gas", 11161.75, 11178.5, "sector", "OIL & GAS"],
  ["NIFTYCMDT", "Nifty Commodities", 9784.45, 9783.47, "sector", "METAL"],
  ["NIFTYCPSE", "Nifty CPSE", 6475.05, 6428.75, "sector", "POWER"],
  ["NIFTYPSE", "Nifty PSE", 9775.2, 9743.05, "sector", "POWER"],
  ["NIFTYMNC", "Nifty MNC", 33128.05, 33211.0, "sector", "FMCG"],
  ["NIFTYCONSUMP", "Nifty Consumption", 12016.3, 12066.98, "sector", "FMCG"],
  ["NIFTYSERV", "Nifty Services", 30923.5, 30889.52, "sector", "SERVICES"],
  ["NIFTYCHEM", "Nifty Chemicals", 30087.5, 30250.85, "sector", "CHEMICALS"],
];

const SECTORS = [
  "BANKING",
  "PSU BANK",
  "FINANCIAL SERVICES",
  "INSURANCE",
  "IT",
  "PHARMA",
  "HEALTHCARE",
  "AUTO",
  "FMCG",
  "CONSUMER DURABLES",
  "METAL",
  "ENERGY",
  "OIL & GAS",
  "POWER",
  "REALTY",
  "INFRA",
  "CAPITAL GOODS",
  "CEMENT",
  "TELECOM",
  "MEDIA",
  "CHEMICALS",
  "DEFENCE",
  "SERVICES",
];

const HERO_BUY = new Set(["RELIANCE", "SBIN", "TATAPV", "TATACV", "HINDALCO", "BEL", "TRENT"]);
const HERO_SELL = new Set(["INFY", "WIPRO", "ASIANPAINT", "HINDUNILVR", "TECHM"]);

const FY_SYMBOL = {
  NIFTY: "NSE:NIFTY50-INDEX",
  BANKNIFTY: "NSE:NIFTYBANK-INDEX",
  SENSEX: "BSE:SENSEX-INDEX",
  INDIAVIX: "NSE:INDIAVIX-INDEX",
  FINNIFTY: "NSE:FINNIFTY-INDEX",
  NIFTYNXT50: "NSE:NIFTYNXT50-INDEX",
  NIFTY100: "NSE:NIFTY100-INDEX",
  NIFTY500: "NSE:NIFTY500-INDEX",
  MIDCAP100: "NSE:NIFTYMIDCAP100-INDEX",
  MIDCAP50: "NSE:NIFTYMIDCAP50-INDEX",
  SMALLCAP100: "NSE:NIFTYSMLCAP100-INDEX",
  SMALLCAP250: "NSE:NIFTYSMLCAP250-INDEX",
  MICROCAP250: "NSE:NIFTYMICROCAP250-INDEX",
  NIFTYIT: "NSE:NIFTYIT-INDEX",
  NIFTYAUTO: "NSE:NIFTYAUTO-INDEX",
  NIFTYPHARMA: "NSE:NIFTYPHARMA-INDEX",
  NIFTYFMCG: "NSE:NIFTYFMCG-INDEX",
  NIFTYMETAL: "NSE:NIFTYMETAL-INDEX",
  NIFTYENERGY: "NSE:NIFTYENERGY-INDEX",
  NIFTYREALTY: "NSE:NIFTYREALTY-INDEX",
  TATAPV: "NSE:TMPV-EQ",
  TATACV: "NSE:TMCV-EQ",
  TMPV: "NSE:TMPV-EQ",
  TMCV: "NSE:TMCV-EQ",
};

const FY_TO_INTERNAL = {
  "NSE:TMPV-EQ": "TATAPV",
  "NSE:TMCV-EQ": "TATACV",
  TMPV: "TATAPV",
  TMCV: "TATACV",
  TATAMOTORS: "TATAPV",
  ZOMATO: "ETERNAL",
  "NSE:ETERNAL-EQ": "ETERNAL",
  "NSE:NIFTY50-INDEX": "NIFTY",
  NIFTY50: "NIFTY",
  "NSE:NIFTYBANK-INDEX": "BANKNIFTY",
  NIFTYBANK: "BANKNIFTY",
  "BSE:SENSEX-INDEX": "SENSEX",
  "NSE:INDIAVIX-INDEX": "INDIAVIX",
  "NSE:FINNIFTY-INDEX": "FINNIFTY",
};

function fySymbol(sym) {
  return FY_SYMBOL[sym] || `NSE:${sym}-EQ`;
}

function internalFromFy(n) {
  const raw = String(n || "");
  if (FY_TO_INTERNAL[raw]) return FY_TO_INTERNAL[raw];
  const short = raw.replace(/^NSE:/, "").replace(/^BSE:/, "").replace(/-EQ$/, "").replace(/-INDEX$/, "");
  return FY_TO_INTERNAL[short] || short;
}

function isCashSessionOpen() {
  return getMarketStatus().open === true;
}

function makeBar(t, o, r) {
  const drift = (r() - 0.48) * 0.004;
  const shock = r() > 0.97 ? (r() - 0.5) * 0.012 : 0;
  const c = o * (1 + drift + shock);
  const spread = Math.abs(c - o) + o * (0.001 + r() * 0.003);
  const h = Math.max(o, c) + spread * r() * 0.6;
  const l = Math.min(o, c) - spread * r() * 0.6;
  const v = 40000 + r() * 180000;
  return { t, o, h, l, c, v };
}

function generateBars(symbol, base, bias, n = 160) {
  const rand = mulberry32(hashStr(symbol + ":bars:v4"));
  const bars = [];
  const end = getMarketStatus().open ? Math.floor(Date.now() / 300000) * 300000 : lastSessionCloseMs();
  const t0 = end - (n - 1) * 5 * 60 * 1000;
  let px = base * (0.985 + rand() * 0.02);
  for (let i = 0; i < n; i++) {
    let local = bias;
    if (i > n - 28 && HERO_BUY.has(symbol)) local = "bull";
    if (i > n - 28 && HERO_SELL.has(symbol)) local = "bear";
    const tilt = local === "bull" ? 0.0011 : local === "bear" ? -0.0011 : 0;
    const o = px;
    const drift = (rand() - 0.48) * 0.0038 + tilt;
    const volCluster = i > n - 18 ? 1.8 : 1;
    let c = o * (1 + drift);
    if (local === "bull" && i === n - 12) c = o * 1.006;
    if (local === "bear" && i === n - 12) c = o * 0.994;
    const spread = Math.abs(c - o) + o * (0.0009 + rand() * 0.0025);
    const h = Math.max(o, c) + spread * rand() * 0.7;
    const l = Math.min(o, c) - spread * rand() * 0.7;
    const v = (50000 + rand() * 220000) * volCluster * (local === "chop" ? 0.7 : 1.15);
    bars.push({ t: t0 + i * 5 * 60 * 1000, o, h, l, c, v });
    px = c;
  }
  const last = bars[bars.length - 1].c || base;
  const scale = base / last;
  return bars.map((b, i) => {
    const o = +(b.o * scale).toFixed(2);
    const h = +(b.h * scale).toFixed(2);
    const l = +(b.l * scale).toFixed(2);
    let c = +(b.c * scale).toFixed(2);
    if (i === bars.length - 1) c = +base.toFixed(2);
    return { ...b, o, h: Math.max(h, o, c), l: Math.min(l, o, c), c };
  });
}

function tickBar(bar, bias, rand) {
  if (!isCashSessionOpen()) return bar;
  const tilt = bias === "bull" ? 0.00025 : bias === "bear" ? -0.00025 : 0;
  const d = (rand() - 0.5) * 0.0018 + tilt;
  const c = bar.c * (1 + d);
  return {
    ...bar,
    c,
    h: Math.max(bar.h, c),
    l: Math.min(bar.l, c),
    v: bar.v + 800 + rand() * 4000,
    t: Date.now(),
  };
}

const universe = new Map();
const listeners = new Set();
let selected = "RELIANCE";
let regime = { label: "NEUTRAL", score: 50, note: "" };
let ticking = false;
let tickTimer = null;
let liveMode = false;

function catalog() {
  const rows = [];
  for (const [sym, name, close, chg, sector] of NIFTY50) {
    rows.push({
      symbol: sym,
      name,
      base: close,
      prevClose: +(close - chg).toFixed(2),
      sector,
      nifty50: true,
      fno: true,
      cap: "LARGE",
    });
  }
  for (const [sym, name, close, prev, sector] of EXTRA_FNO) {
    rows.push({ symbol: sym, name, base: close, prevClose: prev, sector, nifty50: false, fno: true, cap: "MID" });
  }
  for (const [sym, name, close, prev, sector, cap] of EXTRA_SECTOR) {
    rows.push({ symbol: sym, name, base: close, prevClose: prev, sector, nifty50: false, fno: false, cap: cap || "MID" });
  }
  return rows;
}

function biasFor(sym) {
  if (HERO_BUY.has(sym)) return "bull";
  if (HERO_SELL.has(sym)) return "bear";
  const r = mulberry32(hashStr(sym))();
  if (r > 0.7) return "bull";
  if (r < 0.3) return "bear";
  return "chop";
}

function enrich(row) {
  const settings = Storage.getSettings();
  const sessionStart = Math.max(0, row.bars.length - 75);
  const ta = analyzeBars(row.bars, settings, { sessionStart, regime: regime.label });
  const piv = classicPivots(ta.levels.pdh, ta.levels.pdl, ta.levels.pdc);
  ta.levels.r1 = piv.r1;
  ta.levels.s1 = piv.s1;
  const dirHint = ta.align.bias === "BEAR" ? "SELL" : ta.align.bias === "BULL" ? "BUY" : ta.aboveVwap ? "BUY" : "SELL";
  const plan = buildPlan(ta, dirHint);
  const scored = scoreSymbol(ta, { regime: regime.label, rr: plan.rr });
  const mkt = getMarketStatus();
  const marketOpen = mkt.code === "OPEN";
  const decided = decideSignal({
    score: scored.score,
    dir: scored.dir,
    rr: plan.rr,
    ta,
    regime: regime.label,
    marketOpen,
    analysisMode: settings.scanner.analysisMode,
  });
  const prev = row.bars.length > 2 ? row.bars[row.bars.length - 2].c : row.base;
  const ch = ta.price - (row.prevClose || prev);
  const chp = (ch / (row.prevClose || prev)) * 100;
  return {
    ...row,
    ltp: ta.price,
    ch,
    chp,
    ta,
    plan,
    score: scored.score,
    scoreParts: scored.parts,
    reasons: scored.reasons,
    risks: scored.risks,
    label: scored.label,
    signal: decided.signal,
    signalWhy: decided.why,
    dir: scored.dir,
    fy: fySymbol(row.symbol),
  };
}

function computeRegime(rows) {
  const nifty = rows.find((r) => r.symbol === "NIFTY") || indexFromMean(rows, "NIFTY");
  const vix = rows.find((r) => r.symbol === "INDIAVIX");
  const n50 = rows.filter((r) => r.nifty50);
  const aboveVwap = n50.filter((r) => r.ta.aboveVwap).length / Math.max(1, n50.length);
  const emaBull = n50.filter((r) => r.ta.align.bias === "BULL").length / Math.max(1, n50.length);
  const adv = n50.filter((r) => r.chp > 0).length;
  const dec = n50.filter((r) => r.chp < 0).length;
  const breadth = adv / Math.max(1, adv + dec);
  const ta = nifty?.ta;
  let pts = 0;
  if (ta) {
    if (ta.price > ta.vwap) pts += 1.2;
    else pts -= 1.2;
    if (ta.price > ta.ema20) pts += 1;
    else pts -= 1;
    if (ta.ema20 > ta.ema50) pts += 1;
    else pts -= 1;
    if (ta.ema50 && ta.ema200 && ta.ema50 > ta.ema200) pts += 0.8;
    else pts -= 0.6;
    if (ta.rsi > 55) pts += 0.7;
    else if (ta.rsi < 45) pts -= 0.7;
    if (ta.momentum > 0.2) pts += 0.6;
    else if (ta.momentum < -0.2) pts -= 0.6;
    if (ta.rvol > 1.2) pts += 0.4;
  }
  pts += (aboveVwap - 0.5) * 2.2;
  pts += (emaBull - 0.5) * 2;
  pts += (breadth - 0.5) * 2;
  const vixPx = vix?.ltp || 13;
  if (vixPx > 18) pts -= 0.8;
  else if (vixPx < 12) pts += 0.4;
  const conf = Math.min(92, Math.max(54, 50 + Math.abs(pts) * 8));
  let label = "NEUTRAL";
  if (pts >= 3.2) label = "STRONG BULLISH";
  else if (pts >= 1.2) label = "BULLISH";
  else if (pts <= -3.2) label = "STRONG BEARISH";
  else if (pts <= -1.2) label = "BEARISH";
  return {
    label,
    score: Math.round(conf),
    pts,
    breadth: { adv, dec, aboveVwap, emaBull },
    vix: vixPx,
    note: "Confluence score from NIFTY vs VWAP/EMA, RSI, momentum, volume, breadth and VIX. Not a probability.",
  };
}

function indexFromMean() {
  return null;
}

function buildIndex(symbol, name, close, prevClose, kind = "broad", sector = "INDEX") {
  const bars = generateBars(symbol, close, "chop");
  return enrich({
    symbol,
    name,
    base: close,
    sector,
    kind,
    nifty50: false,
    fno: true,
    bars,
    prevClose,
    isIndex: true,
  });
}

function sectorCards(rows) {
  const map = {};
  for (const s of SECTORS) map[s] = [];
  for (const r of rows) {
    if (r.isIndex) continue;
    if (map[r.sector]) map[r.sector].push(r);
  }
  const cards = Object.entries(map)
    .map(([name, list]) => {
      if (!list.length) return null;
      const chp = list.reduce((a, b) => a + b.chp, 0) / list.length;
      const rvol = list.reduce((a, b) => a + b.ta.rvol, 0) / list.length;
      const bull = list.filter((x) => x.ta.align.bias === "BULL").length / list.length;
      const niftyChp = universe.get("NIFTY")?.chp || 0;
      const rs = chp - niftyChp;
      let trend = "NEUTRAL";
      if (bull > 0.6 && chp > 0.3) trend = "BULLISH";
      else if (bull < 0.4 && chp < -0.3) trend = "BEARISH";
      const score = Math.max(1, Math.min(10, 5 + chp * 1.4 + (rvol - 1) * 1.2 + rs * 0.8));
      const ranked = list.slice().sort((a, b) => b.chp - a.chp);
      return {
        name,
        chp,
        rvol,
        rs,
        trend,
        score,
        n: list.length,
        adv: list.filter((x) => x.chp > 0).length,
        dec: list.filter((x) => x.chp < 0).length,
        leaders: ranked.slice(0, 3).map((x) => x.symbol),
        laggards: ranked.slice(-3).reverse().map((x) => x.symbol),
      };
    })
    .filter(Boolean);
  cards.sort((a, b) => b.score - a.score);
  return cards;
}

function rescoreAll() {
  for (const row of universe.values()) universe.set(row.symbol, enrich(row));
  regime = computeRegime([...universe.values()]);
  for (const [k, v] of universe) universe.set(k, enrich(v));
  emit();
}

function emit() {
  const detail = snapshot();
  for (const fn of listeners) fn(detail);
  window.dispatchEvent(new CustomEvent("nstox:market", { detail }));
}

function snapshot() {
  const rows = [...universe.values()].filter((r) => !r.isIndex);
  const indices = [...universe.values()].filter((r) => r.isIndex);
  return {
    rows,
    indices: indices.filter((r) => r.kind === "broad"),
    capIndices: indices.filter((r) => r.kind === "cap"),
    sectorIndices: indices.filter((r) => r.kind === "sector"),
    globalIndices: GLOBAL_INDICES.map(([sym, name, region, close, prev, ccy, flag, session]) => {
      const ch = close - prev;
      return {
        symbol: sym,
        name,
        region,
        ltp: close,
        prevClose: prev,
        ch,
        chp: (ch / prev) * 100,
        ccy,
        flag,
        live: isSessionLive(session),
      };
    }),
    regime,
    sectors: sectorCards(rows),
    live: liveMode && isFyersConnected(),
    demo: !(liveMode && isFyersConnected()),
    frozen: !isCashSessionOpen(),
    selected: universe.get(selected),
    market: getMarketStatus(),
  };
}

function seed() {
  universe.clear();
  for (const meta of catalog()) {
    const bias = biasFor(meta.symbol);
    const bars = generateBars(meta.symbol, meta.base, bias);
    universe.set(meta.symbol, { ...meta, bars, bias });
  }
  const tmp = [...universe.values()].map((r) => enrich(r));
  for (const r of tmp) universe.set(r.symbol, r);
  for (const row of [...INDICES, ...CAP_INDICES]) {
    const [sym, name, close, prev, kind] = row;
    universe.set(sym, buildIndex(sym, name, close, prev, kind || "broad"));
  }
  for (const [sym, name, close, prev, kind, sector] of SECTOR_INDICES) {
    universe.set(sym, buildIndex(sym, name, close, prev, kind, sector || "INDEX"));
  }
  regime = computeRegime([...universe.values()]);
  for (const [k, v] of universe) universe.set(k, enrich(v));
  regime = computeRegime([...universe.values()]);
}

function stepTicks() {
  if (!isCashSessionOpen()) return;
  const rand = Math.random;
  for (const row of universe.values()) {
    const last = row.bars[row.bars.length - 1];
    row.bars[row.bars.length - 1] = tickBar(last, row.bias || "chop", rand);
    const next = enrich(row);
    universe.set(row.symbol, next);
  }
  regime = computeRegime([...universe.values()]);
  emit();
}

async function overlayLiveQuotes() {
  if (!isFyersConnected()) return;
  try {
    const syms = [...universe.values()].slice(0, 40).map((r) => r.fy);
    const quotes = await getQuotes(syms);
    liveMode = true;
    for (const q of quotes) {
      const short = internalFromFy(q.symbol);
      const row = universe.get(short);
      if (!row || !q.ltp) continue;
      const last = row.bars[row.bars.length - 1];
      last.c = q.ltp;
      last.h = Math.max(last.h, q.high || q.ltp);
      last.l = Math.min(last.l, q.low || q.ltp);
      if (q.volume) last.v = q.volume;
      if (q.prevClose) row.prevClose = q.prevClose;
      universe.set(short, enrich(row));
    }
    emit();
  } catch {
    liveMode = false;
  }
}

export const Market = {
  init() {
    seed();
    emit();
    return snapshot();
  },
  snapshot,
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  get(sym) {
    const mapped = FY_TO_INTERNAL[sym] || sym;
    return universe.get(mapped) || universe.get(sym);
  },
  getSelected() {
    return universe.get(selected);
  },
  select(sym) {
    if (universe.has(sym)) selected = sym;
    emit();
  },
  getUniverse(kind = "NIFTY50") {
    const all = [...universe.values()].filter((r) => !r.isIndex);
    if (kind === "NIFTY50") return all.filter((r) => r.nifty50);
    if (kind === "FNO") return all.filter((r) => r.fno);
    if (kind === "WATCHLIST") {
      const lists = Storage.getWatchlists();
      const set = new Set(lists.flatMap((l) => l.symbols).map((s) => FY_TO_INTERNAL[s] || s));
      return all.filter((r) => set.has(r.symbol));
    }
    return all;
  },
  indices() {
    return INDICES.map((r) => universe.get(r[0])).filter(Boolean);
  },
  capIndices() {
    return CAP_INDICES.map((r) => universe.get(r[0])).filter(Boolean);
  },
  sectorIndices() {
    return SECTOR_INDICES.map((r) => universe.get(r[0])).filter(Boolean);
  },
  getBySector(name) {
    return [...universe.values()].filter((r) => !r.isIndex && r.sector === name);
  },
  regime() {
    return regime;
  },
  sectors() {
    return sectorCards([...universe.values()]);
  },
  startTicks(ms = 2500) {
    if (ticking) return;
    ticking = true;
    tickTimer = setInterval(() => {
      if (!isCashSessionOpen()) return;
      stepTicks();
      if (isFyersConnected()) overlayLiveQuotes();
    }, ms);
  },
  stopTicks() {
    ticking = false;
    clearInterval(tickTimer);
  },
  refresh() {
    if (isCashSessionOpen()) stepTicks();
    else rescoreAll();
    if (isFyersConnected()) overlayLiveQuotes();
  },
  fySymbol,
  internalFromFy,
  isDemo() {
    return !(liveMode && isFyersConnected());
  },
  isFrozen() {
    return !isCashSessionOpen();
  },
};

export { inr, fmtPct, SECTORS, fySymbol };
