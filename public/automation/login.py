import logging
from playwright.sync_api import Page
from .helpers import take_screenshot, logger

TICKETLOG_HOME_URL = "https://plataforma.ticketlog.com.br/home"

def verificar_sessao_ativa(page: Page) -> bool:
    """
    Verifies if the browser session is already logged in and authenticated.
    """
    try:
        logger.info("Navegando para a página inicial da Ticket Log para validar sessão...")
        page.goto(TICKETLOG_HOME_URL, wait_until="networkidle", timeout=30000)
        
        # Check if we are redirected to a login/auth page
        current_url = page.url
        logger.info(f"URL atual após navegação: {current_url}")
        
        if "login" in current_url.lower() or "auth" in current_url.lower():
            logger.error("Sessão expirada ou não autenticada na plataforma Ticket Log.")
            take_screenshot(page, "sessao_expirada")
            return False
            
        # Check for presence of corporate dashboard elements
        # For example, look for user profile indicators, side menus, or logout buttons
        side_menu = page.locator("nav, .menu-lateral, #menu, .sidebar")
        if side_menu.count() > 0:
            logger.info("Sessão validada com sucesso! Menu corporativo visível.")
            return True
            
        # Secondary check for common logged in elements
        if "home" in current_url.lower():
            logger.info("Sessão autenticada identificada pela URL home.")
            return True
            
        logger.warning("Não foi possível confirmar elementos logados de forma robusta.")
        return False
        
    except Exception as e:
        logger.error(f"Erro ao verificar sessão do usuário: {e}")
        take_screenshot(page, "erro_validacao_sessao")
        return False
