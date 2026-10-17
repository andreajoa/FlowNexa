"""Original FlowNexa lead magnet. Run: python3 docs/funnel-source/build_guide.py.

Requires ReportLab. No network, credentials or production database access.
The brand mark is drawn from the project's original SVG path geometry.
"""
from pathlib import Path
import re
import xml.etree.ElementTree as ET
from xml.sax.saxutils import escape

from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor, Color, white
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "public/assets/funnel/flownexa-guia-direct.pdf"
FONT_DIR = Path("/System/Library/Fonts/Supplemental")
pdfmetrics.registerFont(TTFont("Guide", str(FONT_DIR / "Arial.ttf")))
pdfmetrics.registerFont(TTFont("GuideBold", str(FONT_DIR / "Arial Bold.ttf")))
pdfmetrics.registerFontFamily("Guide", normal="Guide", bold="GuideBold")
W, H = 595.276, 841.89
M = 46
PURPLE, NAVY = HexColor("#663bc8"), HexColor("#1a1036")
INK, MUTED = HexColor("#251d36"), HexColor("#655b75")
PALE, LINE = HexColor("#f3effb"), HexColor("#e3dcef")


def para(c, text, x, y, width=W - 2 * M, size=11, leading=17, color=INK, bold=False):
    style = ParagraphStyle("guide", fontName="GuideBold" if bold else "Guide",
                           fontSize=size, leading=leading, textColor=color)
    p = Paragraph(text, style)
    _, height = p.wrap(width, H)
    p.drawOn(c, x, y - height)
    return y - height


def logo(c, x, y, size=28, color=PURPLE):
    """Use the original logo paths, including quadratic SVG curve conversion."""
    root = ET.parse(ROOT / "public/assets/flownexa-mark.svg").getroot()
    c.saveState()
    c.translate(x, y + size)
    c.scale(size / 120, -size / 120)
    c.setFillColor(color)
    for element in root.iter():
        if not element.tag.endswith("path"):
            continue
        tokens = re.findall(r"[MLHQVCZmlhqvcz]|-?\d+(?:\.\d+)?", element.attrib["d"])
        path = c.beginPath()
        i, command, cx, cy = 0, None, 0, 0
        while i < len(tokens):
            if tokens[i].isalpha():
                command = tokens[i].upper()
                i += 1
            if command == "Z":
                path.close()
                command = None
                continue
            counts = {"M": 2, "L": 2, "H": 1, "V": 1, "Q": 4, "C": 6}
            n = counts[command]
            values = list(map(float, tokens[i:i + n]))
            i += n
            if command == "M":
                cx, cy = values
                path.moveTo(cx, cy)
                command = "L"
            elif command == "L":
                cx, cy = values
                path.lineTo(cx, cy)
            elif command == "H":
                cx = values[0]
                path.lineTo(cx, cy)
            elif command == "V":
                cy = values[0]
                path.lineTo(cx, cy)
            elif command == "Q":
                qx, qy, nx, ny = values
                path.curveTo(cx + 2 / 3 * (qx - cx), cy + 2 / 3 * (qy - cy),
                             nx + 2 / 3 * (qx - nx), ny + 2 / 3 * (qy - ny), nx, ny)
                cx, cy = nx, ny
            elif command == "C":
                path.curveTo(*values)
                cx, cy = values[-2:]
        c.drawPath(path, fill=1, stroke=0)
    c.restoreState()


def footer(c, number, dark=False):
    color = HexColor("#d9cdec") if dark else MUTED
    c.setFillColor(color)
    c.setFont("Guide", 8)
    c.drawString(M, 31, "FLOWNEXA  /  GUIA PRÁTICO DE DIRECT")
    c.drawRightString(W - M, 31, f"{number:02d} / 06")
    c.linkURL("https://flownex.online", (M, 23, M + 220, 42), relative=0)


def page(c, number, label, heading, intro):
    c.setFillColor(white)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    logo(c, M, H - 65, 25)
    para(c, "FlowNexa", M + 34, H - 43, size=13, bold=True, color=NAVY)
    para(c, label.upper(), M, H - 101, size=9, color=PURPLE, bold=True)
    y = para(c, heading, M, H - 125, size=29, leading=34, bold=True, color=NAVY)
    y = para(c, intro, M, y - 16, size=11, leading=17, color=MUTED)
    footer(c, number)
    return y - 27


def card(c, y, number, title, when, script, next_step):
    width = W - 2 * M
    content = escape(script)
    style = ParagraphStyle("script", fontName="Guide", fontSize=12, leading=18, textColor=NAVY)
    p = Paragraph(content, style)
    _, text_height = p.wrap(width - 40, H)
    detail_style = ParagraphStyle("detail", fontName="Guide", fontSize=9, leading=13, textColor=MUTED)
    when_height = Paragraph(escape(when), detail_style).wrap(width - 40, H)[1]
    after_height = Paragraph("<b>Depois:</b> " + escape(next_step), detail_style).wrap(width - 40, H)[1]
    height = 53 + when_height + 13 + text_height + 14 + after_height + 16
    assert y - height > 65, f"Card {number} overflows page"
    c.setFillColor(PALE)
    c.roundRect(M, y - height, width, height, 12, fill=1, stroke=0)
    c.setFillColor(PURPLE)
    c.roundRect(M + 17, y - 38, 27, 24, 6, fill=1, stroke=0)
    para(c, str(number).zfill(2), M + 22, y - 20, 25, 10, 12, white, True)
    para(c, title, M + 54, y - 19, width - 76, 15, 19, NAVY, True)
    py = para(c, escape(when), M + 20, y - 53, width - 40, 9, 13, MUTED)
    p.drawOn(c, M + 20, py - 13 - text_height)
    para(c, "<b>Depois:</b> " + escape(next_step), M + 20,
         py - 27 - text_height, width - 40, 9, 13, MUTED)
    return y - height - 17


def build():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    c = canvas.Canvas(str(OUTPUT), pagesize=(W, H), pageCompression=1)
    c.setTitle("7 mensagens para transformar comentários em conversas | FlowNexa")
    c.setAuthor("FlowNexa")
    c.setSubject("Roteiros originais em português para conversas no Instagram")

    # 01 — Cover
    c.setFillColor(NAVY)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    c.setFillColor(HexColor("#362052"))
    c.circle(W + 60, H - 125, 235, fill=1, stroke=0)
    logo(c, M, H - 86, 38, HexColor("#c5a4ff"))
    para(c, "FlowNexa", M + 51, H - 56, 210, 19, 23, white, True)
    para(c, "GUIA GRATUITO  •  COPIE E ADAPTE", M, 675, size=10, color=HexColor("#cfb8ff"), bold=True)
    y = para(c, "7 mensagens<br/>para transformar<br/>comentários em<br/>conversas", M, 625,
             size=43, leading=48, color=white, bold=True)
    y = para(c, "Um primeiro contato claro. Uma pergunta de cada vez.<br/>Um próximo passo que faça sentido para a pessoa.",
             M, y - 26, size=13, leading=21, color=HexColor("#ded5ed"))
    c.setFillColor(PURPLE)
    c.roundRect(M, 169, W - 2 * M, 88, 12, fill=1, stroke=0)
    para(c, "ROTEIROS + EXEMPLO + CHECKLIST", M + 19, 237, size=10, color=white, bold=True)
    para(c, "Para lojas, profissionais e criadores que querem<br/>organizar respostas no Instagram.", M + 19, 215,
         size=12, leading=18, color=white)
    para(c, "Troque os trechos entre [colchetes] pelos dados reais do seu negócio.<br/>Os textos são exemplos adaptáveis, sem promessa de vendas.",
         M, 121, size=9, leading=14, color=HexColor("#c7bcd7"))
    footer(c, 1, True)
    c.showPage()

    # 02 — Opening and delivery
    y = page(c, 2, "Comece pela intenção", "Entregue o que<br/>a pessoa pediu.",
             "Um comentário mostra interesse em um conteúdo. A primeira mensagem precisa explicar o contexto e facilitar uma resposta.")
    y = card(c, y, 1, "Abra a conversa", "Primeira resposta privada ao comentário.",
             "Olá! Vi seu comentário sobre [tema]. Quer que eu envie [material ou catálogo] por aqui? Responda QUERO para continuar.",
             "Use Aguardar resposta. O comentário sozinho não autoriza uma sequência de mensagens.")
    y = card(c, y, 2, "Cumpra a promessa", "Depois que a pessoa responder de verdade no Direct.",
             "Aqui está [material ou catálogo] que você pediu: [link]. Se o link não abrir, me avise por aqui.",
             "Substitua [link] por um endereço válido. Entregue o conteúdo antes de fazer outra oferta.")
    para(c, "<b>Na prática:</b> uma publicação pode dizer “Comente GUIA para receber os exemplos”. O primeiro Direct pede a resposta; o seguinte entrega o guia.",
         M, y - 2, size=10, leading=16, color=MUTED)
    c.showPage()

    # 03 — Understanding intent and explaining
    y = page(c, 3, "Ajude a pessoa a escolher", "Uma pergunta.<br/>Um caminho relevante.",
             "Use respostas rápidas ou botões de resposta para oferecer escolhas claras. Quem prefere escrever também precisa ter um caminho.")
    y = card(c, y, 3, "Descubra a prioridade", "Após a entrega do conteúdo solicitado.",
             "O que você quer ver primeiro: CATÁLOGO, DETALHES ou AGENDAMENTO? Você pode tocar em uma opção ou escrever sua dúvida.",
             "Conecte Aguardar resposta a Múltiplos caminhos. Crie uma saída para outra resposta.")
    y = card(c, y, 4, "Explique com um exemplo", "No caminho que corresponde à escolha recebida.",
             "Para [objetivo escolhido], o próximo passo é [ação concreta]. Vou mostrar uma imagem com [o que a pessoa verá] para facilitar.",
             "Envie uma imagem própria e verdadeira em outro nó. Se usar vídeo, o arquivo e o cartão com link são envios separados.")
    para(c, "<b>Exemplo para uma loja:</b> “Para escolher o tamanho, compare suas medidas com a tabela. Vou mostrar a imagem com as medidas de cada tamanho.”",
         M, y - 2, size=10, leading=16, color=MUTED)
    c.showPage()

    # 04 — Follow-up and next step
    y = page(c, 4, "Continue com contexto", "Retome sem pressionar.<br/>Convide sem prometer.",
             "Um lembrete só faz sentido quando a pessoa já respondeu e a janela de atendimento continua aberta. Esperar não renova essa janela.")
    y = card(c, y, 5, "Faça um lembrete útil", "Se não houver resposta e ainda estiver dentro das 24 horas da última interação recebida.",
             "Passando para saber se você conseguiu abrir [material ou catálogo]. Se quiser ajuda com [tema], responda por aqui. Sem problema se preferir deixar para depois.",
             "Use um único lembrete neste exemplo. Sem uma resposta ao primeiro Direct do comentário, não envie este texto.")
    y = card(c, y, 6, "Ofereça o próximo passo", "Quando houver interesse no caminho escolhido.",
             "Quer conferir [produto, serviço ou ferramenta] com mais detalhes? Você encontra as informações aqui: [link]. Se tiver uma dúvida antes, pode escrever.",
             "O botão Abrir link leva à página. Ele não informa ao fluxo que a pessoa respondeu.")
    para(c, "<b>Exemplo para FlowNexa:</b> “Quer montar seu próprio fluxo? Conheça o FlowNexa em flownex.online e confira o que está disponível no aplicativo.”",
         M, y - 2, size=10, leading=16, color=MUTED)
    c.showPage()

    # 05 — Finish and sequence
    y = page(c, 5, "Respeite o ritmo", "Encerrar também<br/>é parte do fluxo.",
             "Não é preciso manter uma sequência aberta indefinidamente. Seja claro sobre o que acontece depois e deixe a pessoa decidir.")
    y = card(c, y, 7, "Feche com respeito", "Se a pessoa disser que não quer continuar ou após concluir o atendimento.",
             "Tudo certo. Encerramos por aqui. Quando quiser retomar, envie [palavra-chave] e escolha o que deseja ver.",
             "Encerre o caminho. Não use este encerramento como motivo para iniciar novos lembretes.")
    y = para(c, "Um fluxo simples para começar", M, y - 5, size=18, leading=23, color=NAVY, bold=True)
    steps = [("COMENTÁRIO", "01 · Peça uma resposta"), ("RESPOSTA NO DIRECT", "02 · Entregue o material"),
             ("ESCOLHA RECEBIDA", "03–04 · Entenda e explique"), ("CONTEXTO CERTO", "05–07 · Ajude, convide ou encerre")]
    for tag, title in steps:
        c.setFillColor(PALE)
        c.roundRect(M, y - 59, W - 2 * M, 48, 8, fill=1, stroke=0)
        para(c, tag, M + 14, y - 20, 155, 8, 12, PURPLE, True)
        para(c, title, M + 174, y - 24, W - 2 * M - 190, 11, 15, NAVY, True)
        y -= 63
    c.showPage()

    # 06 — Checklist and honest CTA
    y = page(c, 6, "Antes de publicar", "Faça um teste<br/>como seu cliente faria.",
             "Escolha um único objetivo para o primeiro fluxo. Depois de validar o caminho real, você pode expandir com novos exemplos e escolhas.")
    checklist = [
        "Troque todos os [colchetes] por informações reais e revise o português.",
        "Confira se a palavra-chave do post é a mesma do gatilho configurado.",
        "Abra todos os links no celular e teste os arquivos de imagem e vídeo.",
        "Garanta que cada pergunta tem uma espera e cada saída tem um destino.",
        "Teste resposta positiva, negativa, inesperada e ausência de resposta.",
        "Não envie continuação de comentário sem uma resposta real no Direct.",
        "Confira a janela de 24 horas antes de lembretes e novos envios.",
        "Publique e teste com outra conta; confira os registros de execução.",
    ]
    for item in checklist:
        c.setStrokeColor(PURPLE)
        c.setLineWidth(1.1)
        c.roundRect(M, y - 12, 12, 12, 2, fill=0, stroke=1)
        y = para(c, escape(item), M + 25, y + 1, W - 2 * M - 25, 10, 15, INK) - 14
    y -= 5
    c.setFillColor(NAVY)
    c.roundRect(M, y - 117, W - 2 * M, 117, 12, fill=1, stroke=0)
    para(c, "Monte o próximo passo no FlowNexa", M + 19, y - 17, size=16, leading=21, color=white, bold=True)
    para(c, "Organize mensagens, escolhas, imagens e esperas<br/>em um fluxo visual para o Instagram.", M + 19, y - 45,
         size=11, leading=17, color=HexColor("#e4d9f4"))
    para(c, '<link href="https://flownex.online" color="#d4baff"><b>Conheça flownex.online →</b></link>',
         M + 19, y - 90, size=11, color=white)
    para(c, "Material original FlowNexa. As mensagens são modelos, não garantia de resultado. Recursos e envios dependem da configuração e das permissões da Meta. Este guia não ensina disparos para quem apenas curtiu ou seguiu o perfil.",
         M, y - 135, size=8, leading=12, color=MUTED)
    c.showPage()
    c.save()
    print(OUTPUT)


if __name__ == "__main__":
    build()
