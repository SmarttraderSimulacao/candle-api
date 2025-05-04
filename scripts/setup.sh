#!/bin/bash
# Script para configurar o ambiente de desenvolvimento

echo -e "\033[1;36m=== CONFIGURAÇÃO DO SERVIDOR DE COMPETIÇÃO DE TRADING ===\033[0m"
echo ""

# Verificar se o Node.js está instalado
if ! command -v node &> /dev/null; then
    echo -e "\033[1;31mErro: Node.js não encontrado. Por favor, instale o Node.js antes de continuar.\033[0m"
    exit 1
fi

echo -e "\033[1;32m✓ Node.js encontrado: $(node -v)\033[0m"
echo -e "\033[1;32m✓ NPM encontrado: $(npm -v)\033[0m"
echo ""

# Instalar dependências
echo -e "\033[1;33mInstalando dependências...\033[0m"
npm install
echo ""

# Instalar dependências adicionais para os scripts
echo -e "\033[1;33mInstalando dependências adicionais para os scripts...\033[0m"
npm install colors --save-dev
echo ""

# Verificar se o arquivo .env existe
if [ ! -f .env ]; then
    echo -e "\033[1;33mCriando arquivo .env inicial...\033[0m"
    cat > .env << EOF
PORT=5000
MONGO_URI=mongodb+srv://richardbragaot:Kikoka543600@cluster0.x12ejdb.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0
JWT_SECRET=trading_competition_secret_key
NODE_ENV=development
EOF
    echo -e "\033[1;32m✓ Arquivo .env criado com sucesso\033[0m"
else
    echo -e "\033[1;32m✓ Arquivo .env já existe\033[0m"
fi

# Criar pasta scripts se não existir
if [ ! -d scripts ]; then
    mkdir -p scripts
    echo -e "\033[1;32m✓ Pasta scripts criada\033[0m"
fi

# Verificar MongoDB
echo -e "\033[1;33mVerificando conexão com MongoDB...\033[0m"
node -e "const mongoose = require('mongoose'); require('dotenv').config(); mongoose.connect(process.env.MONGO_URI).then(() => { console.log('\033[1;32m✓ MongoDB conectado com sucesso\033[0m'); process.exit(0); }).catch(err => { console.error('\033[1;31mErro ao conectar ao MongoDB: ' + err.message + '\033[0m'); process.exit(1); });"

# Se a conexão com o MongoDB for bem-sucedida, continue
if [ $? -eq 0 ]; then
    echo ""
    echo -e "\033[1;33mConfigurando salas iniciais...\033[0m"
    node scripts/setupInitialRooms.js
    
    echo ""
    echo -e "\033[1;33mTestando configuração do servidor...\033[0m"
    node scripts/testServerConfig.js
    
    echo ""
    echo -e "\033[1;32mConfigurando script de inicialização...\033[0m"
    
    # Criar script de inicialização
    cat > start.sh << EOF
#!/bin/bash
echo -e "\033[1;36mIniciando servidor de competição de trading...\033[0m"
node server.js
EOF
    
    chmod +x start.sh
    echo -e "\033[1;32m✓ Script de inicialização criado com sucesso\033[0m"
    
    echo ""
    echo -e "\033[1;32m====================================\033[0m"
    echo -e "\033[1;32m  CONFIGURAÇÃO CONCLUÍDA COM SUCESSO\033[0m"
    echo -e "\033[1;