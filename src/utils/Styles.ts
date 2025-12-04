import { styled } from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";

export const BoxStyleCadastro = {
    backgroundColor: "#ffffff",
    border: "10px solid",
    borderImageSlice: "1",
    borderWidth: "9px",
    borderImageSource: "linear-gradient(to left, #FDA188, #FDA188)",
    borderRadius: "3px",
    boxShadow: "0 9px 40px rgba(42, 42, 42)",
    fontSize: "16px",
    maxWidth: "752px",
    width: "100%",
    display: "flex",
    flexDirection: "column",
    margin: "30px auto",
    padding: "2.5em",
  };

  export const BoxStyleRematricula = {
    backgroundColor: "#ffffff",
  // Nota: borderImage muitas vezes anula o borderRadius em CSS.
  // Se quiser cantos arredondados reais, considere usar border normal com cor sólida ou um wrapper.
  border: "10px solid", 
  borderImageSlice: "1",
  borderWidth: "9px",
  borderImageSource: "linear-gradient(to left, #FDA188, #FDA188)", 
  borderRadius: "3px", // Pode não funcionar devido ao borderImage
  boxShadow: "0 9px 40px rgba(42, 42, 42, 0.1)", // Ajustei a opacidade para ficar mais leve
  fontSize: "16px",
  width: "100%",
  display: "flex",
  flexDirection: "column",
  margin: "30px auto",
  padding: "2.5em",
  };

// --- NOVOS ESTILOS PARA A TABELA DE REMATRICULA ---
export const tableHeaderStyle = {
  backgroundColor: '#f8f9fa', // Cinza muito suave para o cabeçalho
  fontWeight: 700,
  color: '#2c3e50',
  textTransform: 'uppercase',
  fontSize: '0.75rem',
  letterSpacing: '0.05em',
  borderBottom: '2px solid #eef2f6'
};

export const tableRowHoverStyle = {
  '&:hover': {
    backgroundColor: '#fff8f6 !important', // Um tom muito sutil de laranja ao passar o mouse, combinando com sua borda
  },
  // Adiciona mais espaço vertical entre as linhas
  '& td': {
    paddingTop: '16px',
    paddingBottom: '16px',
    fontSize: '0.9rem',
    color: '#555',
  }
};
//--------------------------------------------------------------------------------------------
  export const BoxStyleTurmaInfoTable = {
    backgroundColor: "#ffffff",
    border: "10px solid",
    borderImageSlice: "1",
    borderWidth: "9px",
    borderImageSource: "linear-gradient(to left, #FDA188, #FDA188)",
    borderRadius: "3px",
    boxShadow: "0 9px 40px rgba(42, 42, 42)",
    fontSize: "16px",
    width: "100%",
    display: "flex",
    flexDirection: "column",
    margin: "30px auto",
    padding: "2.5em",
  };

  export const BoxStyleFrequencia = {
    backgroundColor: "#ffffff",
    border: "10px solid",
    borderImageSlice: "1",
    borderWidth: "9px",
    borderImageSource: "linear-gradient(to left, #FDA188, #FDA188)",
    borderRadius: "3px",
    boxShadow: "0 9px 40px rgba(42, 42, 42)",
    fontSize: "16px",
    width: "100%",
    display: "flex",
    flexDirection: "column",
    margin: "30px auto",
    padding: "2.5em",
  };
  
  
  export const TituloDaPagina = {
    marginTop: "1.125rem",
    width: "100%",
    marginBottom: "5px",
    textAlign: "center",
    color: "#000000",
    fontSize: "2em",
    fontWeight: "600",
    lineHeight: "1.45",
  };
  
  export const SubtituloDaPagina = {
    color: "#264B67",
    fontSize: "1em",
    fontWeight: "500",
    lineHeight: "1.6",
  };
  
  export const ListStyle = {
    borderColor: "#83D0E4",
    borderBottom: "1px solid #83D0E4",
    padding: "14px",
    marginTop: "1.125em",
    marginBottom: "auto",
    textAlign: "left",
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
  };
  export const TituloSecaoStyle = {
    color: "#000000",
    fontSize: "1.25rem",
    marginBottom: "20px",
    fontWeight: "600",
    lineHeight: "1.45",
  };


 
 // Estilos para o modal
export const modalStyle = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 'auto',
  bgcolor: 'background.paper',
  boxShadow: 24,
  p: 4,
  outline: 'none',
  maxHeight: '80vh',
  overflowY: 'auto',
  color:"black",
  '& h2': {
    fontSize: '1.25rem',
    marginBottom: '0.5rem',
  },
  '& p': {
    fontSize: '1rem',
    lineHeight: '1.5',
    '&:not(:last-child)': {
      marginBottom: '0.5rem',
    },
  },
};

export const cardStyle = {
  textAlign: "center",
  background: "transparent",
  boxShadow: "none", // Isso remove a borda/caixa de sombra
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
};

export const cardMediaStyle = {
   textDecoration: 'none',
   color: 'inherit' ,
  "@media (max-width:600px)": {
    height: "70%", // ou um valor específico em pixels
    width: "70%", // ou um valor específico em pixels
    marginTop:"10px"
  },
};

// Estilos para o Modal
export const modalStyleTemporaly = {
  position: 'absolute' as 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 'auto',
  bgcolor: 'background.paper',
  boxShadow: 24,
  p: 4,
  outline: 'none', // Remove o foco do outline padrão
  border: "10px solid",
  borderImageSlice: "1",
  borderWidth: "9px",
  borderImageSource: "linear-gradient(to left, #FDA188, #FDA188)",
  borderRadius: "3px",
  fontSize: "16px",
  display: "flex",
  flexDirection: "column",
  margin: "30px auto",
  padding: "2.5em",
};



export const StyledDataGrid = styled(DataGrid)(({ theme }) => ({
  border: 0,
  color: theme.palette.text.primary, // Texto com cor primária do tema
  fontFamily: theme.typography.fontFamily, // Fonte do tema
  WebkitFontSmoothing: "auto",
  letterSpacing: "normal",
  backgroundColor: "rgba(250, 250, 250, 0.65)", // Fundo mais transparente para harmonizar com o gradiente
  
  "& .MuiDataGrid-columnsContainer": {
    backgroundColor: "#3e3e3e", // Cabeçalho escuro
    color: "#ffffff", // Texto claro no cabeçalho
  },
  
  "& .MuiDataGrid-columnHeader, .MuiDataGrid-cell": {
    borderRight: `1px solid ${theme.palette.divider}`, // Borda à direita das células
    backgroundColor: "white", // Efeito ao passar o mouse
  },

  "& .MuiDataGrid-columnHeaderTitle": {
    color: "black",
    fontWeight: '600'
  },
  
  "& .MuiDataGrid-columnsContainer, .MuiDataGrid-cell": {
    borderBottom: `1px solid ${theme.palette.divider}`,
  },
  
  "& .MuiDataGrid-cell": {
    color: "#333333", // Texto escuro nas células
    backgroundColor: "#e0e0e0", // Fundo mais claro para as células
    cursor:"pointer"
  },
  
  "& .MuiPaginationItem-root": {
    borderRadius: 0,
  },

  "& .MuiInputBase-input": {
    color: "#3e3e3e", // Texto escuro para inputs
    borderBottom: `2px solid ${theme.palette.divider}`,
  },
  
  "& .MuiInputBase-input::placeholder": {
    color: "black", 
    fontWeight: '600',
  },
  
  "& .MuiSvgIcon-root.MuiSvgIcon-fontSizeSmall": {
    color: "black", // Ícones brancos para contraste
  },
}));



