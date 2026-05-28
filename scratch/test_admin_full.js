const url = "http://18.231.110.109:8080";

async function run() {
    console.log("1. Sending login POST request...");
    
    let cookie = "";

    const loginParams = new URLSearchParams();
    loginParams.append("username", "admin");
    loginParams.append("password", "Nanapepo1329@");

    const loginRes = await fetch(`${url}/?subtopic=account/manage`, {
        method: "POST",
        body: loginParams,
        headers: {
            "Content-Type": "application/x-www-form-urlencoded"
        },
        redirect: "manual"
    });

    const setCookie = loginRes.headers.get("set-cookie");
    if (setCookie) {
        cookie = setCookie.split(";")[0];
        console.log(`✅ Session Cookie: ${cookie}`);
    } else {
        console.log("❌ Failed to login: no set-cookie header received.");
        return;
    }

    // A. TEST BALANCE UPDATE
    console.log("\n2. Submitting Lich King balance parameters...");
    const balanceParams = new URLSearchParams();
    balanceParams.append("name", "Lich King");
    balanceParams.append("category", "boss");
    balanceParams.append("hp", "32000");
    balanceParams.append("speed", "0.7");
    balanceParams.append("damage", "350");
    balanceParams.append("defense", "0");
    balanceParams.append("attackRange", "15");
    balanceParams.append("attackCooldown", "6000");
    balanceParams.append("hitboxRadius", "1.5");
    balanceParams.append("xp", "50000");
    balanceParams.append("score", "25000");

    const balanceRes = await fetch(`${url}/?subtopic=admin/balance&entity=LichKing`, {
        method: "POST",
        body: balanceParams,
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Cookie": cookie
        }
    });

    const balanceHtml = await balanceRes.text();
    if (balanceHtml.includes("Alterações salvas com sucesso no arquivo JSON")) {
        console.log("✅ Balance parameters for Lich King saved successfully!");
        if (balanceHtml.includes("Hot-Reload")) {
            console.log("✅ Hot-Reload executed on game server successfully!");
        }
    } else {
        console.log("❌ Failed to save balance parameters.");
        const errorMatch = balanceHtml.match(/⚠️ (.*?)<\/div>/);
        if (errorMatch) {
            console.log(`Error Message: ${errorMatch[1]}`);
        } else {
            console.log(balanceHtml.substring(0, 1000));
        }
    }

    // B. TEST POST UPDATE
    console.log("\n3. Posting Lich King rework update note...");
    const postParams = new URLSearchParams();
    postParams.append("type", "Novidade");
    postParams.append("target", "Lich King (Arthas)");
    postParams.append("description", "Rework completo do Lich King implementado com sucesso! Adicionado modelo 3D low-poly, 4 habilidades ativas (Defile, Concentric Shockwaves, Twin Valkyrs, Sindragosa's Wrath) e o drop da Alma de Arthas que concede +30% de dano congelante, imunidade a gelo/deslize e 5% lifesteal.");

    const postRes = await fetch(`${url}/?subtopic=updates/post`, {
        method: "POST",
        body: postParams,
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Cookie": cookie
        }
    });

    const postHtml = await postRes.text();
    if (postHtml.includes("Atualização postada com sucesso")) {
        console.log("✅ Update posted successfully!");
    } else {
        console.log("❌ Failed to post update.");
        const errorMatch = postHtml.match(/⚠️ (.*?)<\/div>/);
        if (errorMatch) {
            console.log(`Error Message: ${errorMatch[1]}`);
        } else {
            console.log(postHtml.substring(0, 1000));
        }
    }

    // C. VERIFY NEWS PAGE
    console.log("\n4. Verifying if update is visible on home page...");
    const newsRes = await fetch(`${url}/?subtopic=news`);
    const newsHtml = await newsRes.text();
    if (newsHtml.includes("Rework completo do Lich King")) {
        console.log("✅ VERIFICATION COMPLETE: The updates form works and updates are live!");
    } else {
        console.log("❌ Update is not visible on home page.");
    }
}

run().catch(console.error);
