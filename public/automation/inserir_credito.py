import time
from playwright.sync_api import Page
from .helpers import (
    logger, 
    take_screenshot, 
    dump_html_on_error, 
    wait_and_click, 
    clean_monetary_value
)

def executar_insercao_credito(page: Page, gerencia_nome: str, valor_extra: float) -> float:
    """
    Executes the budget adjustment for a specific 'Gerência' inside Ticket Log.
    Returns the new updated budget.
    """
    logger.info(f"Iniciando Etapa 1: Gestão Orçamentária para a Gerência '{gerencia_nome}' com adicional de R$ {valor_extra:.2f}")
    
    # 1. Access Financeiro -> Gestão Orçamentária
    # Wait and hover or click on 'Financeiro' menu
    wait_and_click(page, "text=Financeiro", timeout_ms=15000)
    
    # Click on 'Gestão Orçamentária' submenu
    wait_and_click(page, "text=Gestão Orçamentária", timeout_ms=10000)
    page.wait_for_load_state("networkidle")
    
    # Take screenshot of the Budget page
    take_screenshot(page, "gestao_orcamentaria_loaded")
    
    # 2. Locate the row matching the Management (Gerência)
    # Using text locator with robust xpath/selector
    logger.info(f"Localizando linha correspondente à Gerência: '{gerencia_nome}'...")
    
    # Find row containing the specific Management string
    row_locator = page.locator(f"tr:has-text('{gerencia_nome}')")
    
    if row_locator.count() == 0:
        # Fallback to loose check
        row_locator = page.locator(f"div.row:has-text('{gerencia_nome}')")
        
    if row_locator.count() == 0:
        msg = f"Gerência '{gerencia_nome}' não foi localizada na tabela de Orçamento."
        logger.error(msg)
        take_screenshot(page, "erro_gerencia_nao_encontrada")
        dump_html_on_error(page, "erro_gerencia_nao_encontrada")
        raise ValueError(msg)
        
    logger.info(f"Gerência '{gerencia_nome}' localizada com sucesso.")
    
    # 3. Locate and Click on the Edit (editar.png/pencil) button inside that specific row
    edit_button = row_locator.locator("img[src*='editar'], .btn-editar, .icon-pencil, button.edit")
    
    if edit_button.count() == 0:
        # Fallback search inside the parent/sibling of the matched text
        edit_button = page.locator(f"xpath=//tr[contains(., '{gerencia_nome}')]//img[contains(@src, 'editar')]")
        
    if edit_button.count() == 0:
        msg = "Botão Editar (ícone caneta/editar.png) não foi localizado para a gerência."
        logger.error(msg)
        raise ValueError(msg)
        
    edit_button.first.click()
    logger.info("Botão editar clicado. Aguardando formulário de edição...")
    page.wait_for_timeout(2000) # Wait for animation / modal
    
    # 4. Locate 'Orçamento ABASTECIMENTO/SERVIÇOS' field
    # We find the input field labeled with 'Orçamento ABASTECIMENTO' or similar
    input_locator = page.locator("input[name*='abastecimento'], input[id*='abastecimento'], input[placeholder*='ABASTECIMENTO']")
    
    if input_locator.count() == 0:
        # Fallback by looking for labels
        input_locator = page.locator("label:has-text('ABASTECIMENTO') + input, div:has-text('ABASTECIMENTO') > input")
        
    if input_locator.count() == 0:
        # Final generic selector
        input_locator = page.locator(".input-orcamento, #txtOrcamento, input[type='text']").first
        
    # Read existing budget value
    valor_atual_str = input_locator.input_value()
    logger.info(f"Valor atual de orçamento lido: {valor_atual_str}")
    
    valor_atual = clean_monetary_value(valor_atual_str)
    novo_valor = valor_atual + valor_extra
    
    logger.info(f"Cálculo: Atual ({valor_atual}) + Extra ({valor_extra}) = Novo Total ({novo_valor})")
    
    # Format value to Brazilian currency pattern (e.g. 23608.41 -> 23.608,41)
    novo_valor_str = f"{novo_valor:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    
    # Insert new value
    input_locator.fill("")
    input_locator.fill(novo_valor_str)
    logger.info(f"Novo valor '{novo_valor_str}' inserido no campo de orçamento.")
    
    # Take screenshot before saving
    take_screenshot(page, "pre_salvar_orcamento")
    
    # 5. Click Save & Confirm Popup
    btn_salvar = page.locator("text=Salvar, button:has-text('Salvar'), .btn-salvar, #btnSalvar")
    btn_salvar.first.click()
    logger.info("Botão Salvar clicado. Aguardando confirmação...")
    
    # Wait for the success alert/popup and click OK
    page.wait_for_timeout(1500)
    popup_ok = page.locator("text=OK, button:has-text('OK'), .confirm-btn")
    if popup_ok.count() > 0:
        popup_ok.first.click()
        logger.info("Confirmação de orçamento salva com sucesso (OK clicado).")
        
    take_screenshot(page, "pos_salvar_orcamento")
    return novo_valor
