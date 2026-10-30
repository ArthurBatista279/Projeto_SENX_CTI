// Executado por --delivery-integration, com contas temporárias fornecidas por ambiente.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
(async () => {
  const browser = await chromium.launch({channel:'chrome',headless:true});
  const page = await browser.newPage({viewport:{width:1440,height:960},acceptDownloads:true});
  const base = process.env.SENX_QA_BASE || 'http://localhost:5087';
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  const artifacts=process.env.SENX_QA_ARTIFACTS;
  async function capture(name) {
    if (artifacts) { fs.mkdirSync(artifacts,{recursive:true}); await page.screenshot({path:path.join(artifacts,name+'.png'),fullPage:true}); }
  }
  try {
    await page.goto(base);
    await page.locator('#login-email').fill(process.env.SENX_QA_EMAIL);
    await page.locator('#login-password').fill(process.env.SENX_QA_PASSWORD);
    await page.locator('#auth-form [type=submit]').click();
    await page.waitForFunction(()=>window.SenxData.source==='postgresql');
    assert.match(await page.title(),/0\.1\.5\.0/);
    await capture('01-ligacoes');
    await page.goto(base+'/#resumos');
    await page.locator('[data-action=select-call][data-id="'+process.env.SENX_QA_CALL+'"]').click();
    await page.locator('[data-action=review-call]').click();
    await page.locator('#review-call-form textarea').fill('Resumo revisado pelo navegador QA');
    await page.locator('#review-call-form [name=score]').fill('0');
    await page.locator('#review-call-form [type=submit]').click();
    await page.waitForFunction(id=>window.SenxData.calls.find(c=>c.id===id)?.summary==='Resumo revisado pelo navegador QA',process.env.SENX_QA_CALL);
    await page.reload();
    await page.waitForFunction(id=>window.SenxData.calls.find(c=>c.id===id)?.summary==='Resumo revisado pelo navegador QA',process.env.SENX_QA_CALL);
    await page.locator('[data-action=select-call][data-id="'+process.env.SENX_QA_CALL+'"]').click();
    await page.locator('[data-action=validate-call]').click();
    await page.waitForFunction(id=>window.SenxData.calls.find(c=>c.id===id)?.reviewed===true,process.env.SENX_QA_CALL);
    await capture('02-resumos');
    await page.goto(base+'/#relatorios');
    await page.locator('[data-action=new-report]').click();
    const reportTitle = 'QA relatório <img src=x onerror=alert(1)>';
    await page.locator('#report-form [name=title]').fill(reportTitle);
    await page.locator('#report-form [name=teamId]').selectOption(process.env.SENX_QA_TEAM);
    await page.locator('#report-form [type=submit]').click();
    await page.waitForFunction(title=>window.SenxData.reports.some(r=>r.title===title),reportTitle);
    await page.reload();
    await page.waitForFunction(title=>window.SenxData.reports.some(r=>r.title===title),reportTitle);
    const reportRow=page.locator('tr').filter({hasText:reportTitle});
    await reportRow.locator('[data-action=view-report]').click();
    assert.equal(await page.locator('#dialog-title').textContent(),reportTitle);
    assert.equal(await page.locator('#dialog-title img').count(),0,'Título persistido deve ser texto, não HTML');
    assert.match(await page.locator('dialog').innerText(),/Ligações: 1/);
    await page.locator('dialog [data-action=close]').first().click();
    const download=page.waitForEvent('download');
    await reportRow.locator('[data-action=export-report]').click();
    assert.match((await download).suggestedFilename(),/SENX-Relatorio/);
    await capture('03-relatorios');
    await page.goto(base+'/#rankings');
    assert.match(await page.locator('main').innerText(),/Regras de classificação em definição/);
    for(const route of ['ligacoes','resumos','relatorios','rankings','configuracoes','administracao']) {
      await page.goto(base+'/#'+route);
      await page.waitForTimeout(150);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'overflow desktop '+route);
    }
    await page.setViewportSize({width:390,height:844});
    for(const route of ['ligacoes','resumos','relatorios','rankings','configuracoes','administracao']) {
      await page.goto(base+'/#'+route);
      await page.waitForTimeout(150);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'overflow mobile '+route);
    }
    await capture('04-mobile');
    assert.deepEqual(errors,[]);
    console.log('Navegador: login real, revisão/validação após recarga, relatório persistido, exportação e 12 verificações de layout aprovados.');
  } catch (error) {
    await capture('falha-layout');
    console.log(await page.evaluate(()=>({viewport:innerWidth,width:document.documentElement.scrollWidth,overflow:[...document.querySelectorAll('main *')].filter(el=>el.getBoundingClientRect().right>innerWidth+2).slice(0,12).map(el=>({tag:el.tagName,class:el.className,width:el.getBoundingClientRect().width}))})));
    throw error;
  } finally { await browser.close(); }
})().catch(error=>{console.error(error.message);process.exitCode=1;});
