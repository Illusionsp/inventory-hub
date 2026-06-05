
async function testApi() {
    const baseUrl = "https://inventory-hub-itdv.onrender.com/api";
    console.log(`Testing API at ${baseUrl}...`);

    try {
        const loginRes = await fetch(`${baseUrl}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: "admin@inventorypro.com", password: "admin123" })
        });

        if (!loginRes.ok) {
            console.error("Login failed:", await loginRes.text());
            return;
        }

        const cookies = loginRes.headers.get("set-cookie");
        console.log("Logged in successfully. Cookie:", cookies ? "Set" : "Missing");

        // The 'set-cookie' header might contain multiple cookies separated by commas or just one.
        // We need to pass it back in the 'Cookie' header.

        // Check Sales Report for today
        const today = new Date().toISOString().split('T')[0];
        const reportUrl = `${baseUrl}/reports/sales?from=${today}&to=${today}`;
        console.log(`Fetching: ${reportUrl}`);

        const reportRes = await fetch(reportUrl, {
            headers: { "Cookie": cookies || "" }
        });

        if (reportRes.status === 401) {
            console.error("Authentication failed for report fetch.");
            return;
        }

        const reportData = await reportRes.json();
        console.log("\nSales Report for Today:", JSON.stringify(reportData.summary, null, 2));
        console.log("Invoices count:", reportData.invoices.length);

        if (reportData.invoices.length > 0) {
            console.log("Sample Invoice:", reportData.invoices[0].invoiceNumber, reportData.invoices[0].saleDate);
        }

        // Also check ALL sales
        const allSalesRes = await fetch(`${baseUrl}/sales`, {
            headers: { "Cookie": cookies || "" }
        });
        const allSalesData = await allSalesRes.json();
        console.log("\nAll Sales Total Count:", allSalesData.total);
        if (allSalesData.data.length > 0) {
            console.log("Latest Sale in List:", allSalesData.data[0].invoiceNumber, allSalesData.data[0].saleDate);
        }

    } catch (err) {
        console.error("Error testing API:", err);
    }
}

testApi();
