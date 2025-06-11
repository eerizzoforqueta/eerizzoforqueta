import { TituloDaPagina, SubtituloDaPagina } from "@/utils/Styles";
import { Box, Avatar, Typography } from "@mui/material";
import Image from "next/image";

export const HeaderForm=({titulo}:{titulo:string})=>{
    return(
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            margin: "0 auto",
          }}
        >
          <Avatar
            sx={{
              width: 80, // tamanho do Avatar
              height: 80, // tamanho do Avatar
              // boxShadow: 'none' // Descomente se necessário
              backgroundColor: "white",
              marginTop: "5px",
              marginBottom: "5px",
            }}
          >
            <Image
              src="https://firebasestorage.googleapis.com/v0/b/imagens-9116b.appspot.com/o/logoescolinha-removebg-preview(1).png?alt=media&token=c33b14a0-c768-45a1-926f-94b85770f27b"
              alt=""
              layout="fill" // Isso fará a imagem preencher o Avatar
              objectFit="contain" // Isso garante que a imagem inteira seja visível
            />
          </Avatar>
          <Typography sx={TituloDaPagina}>{titulo}</Typography>
          <Typography sx={SubtituloDaPagina}>Escola Esportiva Rizzo Sports</Typography>
        </Box>
    )

}