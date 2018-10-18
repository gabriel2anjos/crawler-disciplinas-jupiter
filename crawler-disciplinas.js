//Crawlerzão top by Gabriel dos Anjos
var request = require('request');
var cheerio = require('cheerio');
var iconv = require('iconv-lite');
var fs = require('fs');

const ENDERECO_ESTATISTICAS = 'disciplinas/estatisticas.txt';
const ENDERECO_ARQUIVOS = './disciplinas/'
var encoding = 'iso-8859-1';


// Retorna array de unidades (wait)
function crawlerUnidades() {
    return new Promise(resolve => {
        let arrayUnidades = [];
        request.get({ url: 'https://uspdigital.usp.br/jupiterweb/jupColegiadoLista?tipo=D', encoding: null }, function (err, httpResponse, body) {
            {
                body = iconv.decode(body, encoding);
                const $ = cheerio.load(body, {
                });
                let tabelaUnidades = $('#layout_conteudo').find('table').eq(1).children().eq(0).children();
                tabelaUnidades.each(function (i, elem) {
                    if (i != 0) {
                        let num = tabelaUnidades.eq(i).children().eq(0).text().replace(/(\r\n\t|\n|\r\t)/gm, "");
                        num = num.trim(num);
                        let nome = tabelaUnidades.eq(i).children().eq(1).text().replace(/(\r\n\t|\n|\r\t)/gm, "");
                        nome = nome.trim(nome);
                        arrayUnidades.push(
                            {
                                codigo: num,
                                nome: nome,
                            });
                    }
                });
                resolve(arrayUnidades);
            }
        });
    });
}

//Recebe numero da unidade, retorna array de indices
function crawlerPaginas(unidade) {
    return new Promise(resolve => {
        request.get({ url: 'https://uspdigital.usp.br/jupiterweb/jupDisciplinaLista?codcg=' + unidade + '&tipo=D', encoding: null }, function (err, httpResponse, body) {
            {
                let arrayIndices = [];
                body = iconv.decode(body, encoding);
                const $ = cheerio.load(body, {
                });
                if ($('#layout_conteudo').find('table').length==3){
                    arrayIndices.push("A-Z");
                }
                else{
                    let tabelaAlfabetica = $('#layout_conteudo').find('table').eq(0).children().eq(0).children().eq(0).children().filter('td');
                    tabelaAlfabetica.each(function (i, elem) {
                    arrayIndices.push(tabelaAlfabetica.eq(i).text().slice(1, -1));
                    });
                }
                resolve(arrayIndices);
            }
        });
    });
}

//Recebe array de indices, unidade e 
async function crawlerDisciplinas(unidade, arrayIndices) {
    var arrayDisciplinas = [];
    for (indice of arrayIndices) {
        await new Promise(fimRequest => {
            request.get({ url: 'https://uspdigital.usp.br/jupiterweb/jupDisciplinaLista?codcg=' + unidade + '&letra=' + indice + '&tipo=D', encoding: null }, function (err, httpResponse, body) {
                {
                    body = iconv.decode(body, encoding);
                    const $ = cheerio.load(body, {

                    });
                    if (indice == 'A-Z') val = 0; else val = 1;
                    let tabelaDisciplinas = $('#layout_conteudo').find('table').eq(val).children().eq(0).children().filter('tr');
                    tabelaDisciplinas.each(function (i, elem) {
                        let codigo = ($(elem).children().eq(0).children().eq(0).text().replace(/(\r\n\t|\n|\r\t)/gm, ""))
                        codigo = codigo.trim(codigo)
                        let nome = ($(elem).children().eq(1).children().eq(0).text().replace(/(\r\n\t|\n|\r\t)/gm, ""))
                        nome = nome.trim(nome)

                        if (i != 0) {
                            arrayDisciplinas.push(
                                {
                                    nome: nome,
                                    codigo: codigo,
                                    creditos_aula: "",
                                    tipo: "",
                                    turmas: [],
                                });
                        }
                    });
                    fimRequest('Fim');
                }

            });
        });
    }
    return arrayDisciplinas;
}

async function crawlerHorarios(arrayDisciplinas) {
    // disciplinas[indice]['codigo']
    let contador =1;
    for (disciplina of arrayDisciplinas) {
    await new Promise(resolve => {
        console.log(contador+'/'+arrayDisciplinas.length)
        contador++;
        request.get({ url: 'https://uspdigital.usp.br/jupiterweb/obterTurma?sgldis=' + disciplina['codigo'] }, function (err, httpResponse, body) {
            {
                body = iconv.decode(body, encoding);
                const $ = cheerio.load(body, {});
                let tabelaHorarios = $('[name=form1]').children().eq(0).children().eq(0).children().eq(0).children().eq(0).children().filter('table').eq(5).children().eq(0).children().eq(0).children().eq(0).children();
                let numeroOferecimentos = tabelaHorarios.filter('table').length / 3;
                if ($('#web_mensagem').length == 1) {
                    disciplina['turmas'].push({
                        codigo: "Não há oferencimentos para a disciplina",
                        professor: "",
                        horarios: [],
                    });
                    resolve("fim");
                    return 0;
                }
                else {
                    for (let i = 0; i < numeroOferecimentos; i++) {
                        disciplina['turmas'].push({
                            codigo: "",
                            professor: "",
                            horarios: [],
                        });
                        valorIndice = i * 3;
                        codigoTurma = tabelaHorarios.filter('table').eq(valorIndice).children().eq(0).children().eq(0).children().eq(1).text().replace(/(\r\n\t|\n|\r\t)/gm, "");

                        disciplina['turmas'][i]['codigo'] = codigoTurma.trim(codigoTurma);
                        novaTabelaHorarios = tabelaHorarios.filter('table').eq(valorIndice + 1).children().eq(0).children();
                        professor = novaTabelaHorarios.eq(1).children().eq(3).text().replace(/(\r\n\t|\n|\r\t)/gm, "");
                        disciplina['turmas'][i]['professor'] = professor.trim(professor);
                        for (j = 1; j < novaTabelaHorarios.length; j++) {
                            let dia = novaTabelaHorarios.eq(j).children().eq(0).text().replace(/(\r\n\t|\n|\r\t)/gm, "");
                            dia = dia.trim(dia);
                            let inicio = novaTabelaHorarios.eq(j).children().eq(1).text().replace(/(\r\n\t|\n|\r\t)/gm, "");
                            inicio = inicio.trim(inicio);
                            let fim = novaTabelaHorarios.eq(j).children().eq(2).text().replace(/(\r\n\t|\n|\r\t)/gm, "");
                            fim = fim.trim(fim);
                            if (dia != "" || inicio != "" || fim != "") {
                                disciplina['turmas'][i]['horarios'].push({
                                    dia: dia,
                                    inicio: inicio,
                                    fim: fim,
                                });
                            }
                        }
                    }
                    resolve('fim');
                    return 0;

                }
            }
        });
    });}
    return arrayDisciplinas;
    // loopRequests(indice+1);
}

async function crawlerCreditos(arrayDisciplinas) {
    // disciplinas[indice]['codigo']
    let contador=1;
    for (disciplina of arrayDisciplinas) {
        console.log(contador+'/'+arrayDisciplinas.length)
        contador++;
    await new Promise(resolve => {
        request.get({ url: 'https://uspdigital.usp.br/jupiterweb/obterDisciplina?sgldis=' + disciplina['codigo'] }, function (err, httpResponse, body) {
            {
                body = iconv.decode(body, encoding);
                const $ = cheerio.load(body, {});
                let tabelaInformacoes = $('[name=form1]').children().eq(0).children().eq(0).children().eq(0).children().eq(0).children().filter('table').eq(3).children().eq(0).children().filter('tr');
                let creditos = tabelaInformacoes.eq(0).children().eq(1).text().replace(/(\r\n\t|\n|\r\t)/gm, "");
                creditos = creditos.trim(creditos);
                let tipo = tabelaInformacoes.eq(3).children().eq(1).text().replace(/(\r\n\t|\n|\r\t)/gm, "");
                tipo = tipo.trim(tipo);
                disciplina['creditos_aula'] = creditos;
                disciplina['tipo'] = tipo;
                console.log(disciplina)
                resolve('fim');
                return 0;

                
            }
        });
    });}
    return arrayDisciplinas;
    // loopRequests(indice+1);
}

async function main() {
    if (!fs.existsSync(ENDERECO_ARQUIVOS)){
        fs.mkdirSync(ENDERECO_ARQUIVOS);
    }
    fs.writeFile(ENDERECO_ESTATISTICAS, '');
    var data = new Date().getTime();
    var unidades = await crawlerUnidades()
    console.log("Iniciando!");
    console.log('Foram encontradas ' + unidades.length + ' unidades');
    let agora = new Date().getTime();
    console.log('Tempo: ' + (agora - data) + 'ms');
    fs.appendFileSync(ENDERECO_ESTATISTICAS, 'Iniciando!\nForam encontradas ' + unidades.length + ' unidades\nTempo: ' + (agora - data) + 'ms\n');
    console.log("==============================");
    for (unidade of unidades) {
        fs.appendFileSync(ENDERECO_ESTATISTICAS, 'Obtendo disciplinas de '+unidade['nome']+'\n');
        console.log("Obtendo disciplinas de "+unidade['nome'])
        data = new Date().getTime();
        indexes = await crawlerPaginas(unidade['codigo']);
        let arrayDisciplinas = await crawlerDisciplinas(unidade['codigo'], indexes)
        console.log(arrayDisciplinas.length +' disciplinas encontradas!')
        agora = new Date().getTime();
        fs.appendFileSync(ENDERECO_ESTATISTICAS, arrayDisciplinas.length +' disciplinas encontradas\nTempo: ' + (agora - data) + 'ms\nObtendo turmas e creditos\n');
        console.log("Obtendo turmas");
        data = new Date().getTime();
        arrayDisciplinas = await crawlerHorarios(arrayDisciplinas);
        console.log("Obtendo creditos");
        arrayDisciplinas = await crawlerCreditos(arrayDisciplinas);
        fs.appendFileSync(ENDERECO_ARQUIVOS+'disciplinas'+unidade['codigo']+'.txt', JSON.stringify(arrayDisciplinas))
        agora = new Date().getTime();
        fs.appendFileSync(ENDERECO_ESTATISTICAS, 'Concluido!\nTempo: ' + (agora - data) + 'ms\n================\n');
    }

}

// main()
main()
