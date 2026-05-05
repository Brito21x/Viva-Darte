const vendaModel = require('../models/vendaModel');

exports.getVendas = async (req, res) => {
    try {
        const vendas = await vendaModel.obterTodasVendas();
        res.status(200).json(vendas);
    } catch (err) {
        console.error("Erro a obter vendas:", err);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
};

exports.criarVenda = async (req, res) => {
    try {
        await vendaModel.criarVendaCompleta(req.body);
        res.status(201).json({ message: 'Venda criada com sucesso!' });
    } catch (err) {
        console.error("Erro na transação:", err);
        res.status(500).json({ error: 'Erro ao guardar na base de dados.' });
    }
};

exports.atualizarVenda = async (req, res) => {
    try {
        await vendaModel.atualizarVendaCompleta(req.params.id, req.body);
        res.status(200).json({ message: 'Venda atualizada com sucesso!' });
    } catch (err) {
        console.error("⚠️ Erro ao atualizar venda:", err);
        res.status(500).json({ error: 'Erro ao atualizar na base de dados.' });
    }
};

exports.apagarVenda = async (req, res) => {
    try {
        await vendaModel.apagarVendaCompleta(req.params.id);
        res.status(200).json({ message: 'Figurino apagado com sucesso!' });
    } catch (err) {
        console.error("⚠️ Erro no SQL ao apagar:", err);
        return res.status(500).json({ error: 'Erro ao apagar na base de dados.' });
    }
};