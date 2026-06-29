import time
from playwright.sync_api import Page
from .helpers import logger, take_screenshot, wait_and_click

def executar_alteracao_limite(page: Page, placa_veiculo: str, valor_extra: float) -> bool:
    """
    Executes the vehicle limit alteration on the Ticket Log platform.
    """
    logger.info(f"Iniciando Etapa 2: Alteração de Limite para o Veículo '{placa_veiculo}' com acréscimo de R$ {valor_extra:.2f}")
    
    # 1. Access Financeiro -> Alteração de Limite
    wait_and_click(page, "text=Financeiro", timeout_ms=10000)
    wait_and_click(page, "text=Alteração de Limite", timeout_ms=10000)
    page.wait_for_load_state("networkidle")
    
    # Take screenshot of the Limit Alteration page
    take_screenshot(page, "alteracao_limite_loaded")
    
    # 2. Input Vehicle Plate
    placa_input = page.locator("input[name*='placa'], input[id*='placa'], #txtPlaca, input[placeholder*='Placa']")
    if placa_input.count() == 0:
        placa_input = page.locator("input[type='text']").first
        
    placa_input.fill("")
    placa_input.fill(placa_veiculo)
    logger.info(f"Placa '{placa_veiculo}' preenchida no campo Placa do Veículo.")
    
    # Simulate pressing Enter
    placa_input.press("Enter")
    logger.info("Tecla 'Enter' simulada após digitação da placa.")
    page.wait_for_timeout(2000) # Wait for vehicle details to load
    
    # Take screenshot after plate search
    take_screenshot(page, f"veiculo_{placa_veiculo}_carregado")
    
    # 3. Input Alteration Value
    valor_input = page.locator("input[name*='valor'], input[id*='valor'], #txtValor, input[placeholder*='Valor']")
    if valor_input.count() == 0:
        valor_input = page.locator(".input-valor, input[type='text']").nth(1)
        
    valor_input.fill("")
    # Convert value to Brazilian standard format for text inputs
    valor_str = f"{valor_extra:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    valor_input.fill(valor_str)
    logger.info(f"Valor do crédito extra '{valor_str}' inserido.")
    
    # 4. Check "Adicionar o valor ao limite atual" and "Somente para o período" checkboxes
    # Check 'Adicionar ao limite atual'
    chk_adicionar = page.locator("text=Adicionar o valor ao limite atual, input[id*='adicionar'], input[value*='adicionar']")
    if chk_adicionar.count() > 0:
        chk_adicionar.first.check()
    else:
        # Generic locator fallback for checkbox matching options
        chk_adicionar_fallback = page.locator("input[type='checkbox'], input[type='radio']").first
        chk_adicionar_fallback.check()
    logger.info("Checkbox 'Adicionar o valor ao limite atual' selecionada.")
    
    # Check 'Somente para o período'
    chk_periodo = page.locator("text=Somente para o período, input[id*='periodo'], input[value*='periodo']")
    if chk_periodo.count() > 0:
        chk_periodo.first.check()
    else:
        chk_periodo_fallback = page.locator("input[type='checkbox'], input[type='radio']").nth(1)
        chk_periodo_fallback.check()
    logger.info("Checkbox 'Somente para o período' selecionada.")
    
    # Take screenshot before submitting
    take_screenshot(page, "pre_confirmacao_limite")
    
    # 5. Click "Alterar" button
    btn_alterar = page.locator("text=Alterar, button:has-text('Alterar'), #btnAlterar, .btn-alterar")
    btn_alterar.first.click()
    logger.info("Botão 'Alterar' clicado. Aguardando confirmação final...")
    page.wait_for_timeout(1500)
    
    # Click 'OK' on confirmation dialog
    popup_ok = page.locator("text=OK, button:has-text('OK'), .confirm-btn")
    if popup_ok.count() > 0:
        popup_ok.first.click()
        logger.info("Confirmação de alteração de limite efetuada com sucesso (OK clicado).")
        
    take_screenshot(page, "limite_alterado_sucesso")
    return True
